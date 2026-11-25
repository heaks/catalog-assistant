import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type Anthropic from '@anthropic-ai/sdk';
import {
  AgentService,
  recommendedCards,
  type AgentEvent,
} from './agent.service.js';
import type {
  ProductCard,
  ProductToolsService,
} from './product-tools.service.js';

const card = (id: string): ProductCard => ({
  id,
  name: `Product ${id}`,
  brand: null,
  category: null,
  priceUsd: 10,
  imageUrl: null,
});

type Block =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown };
const text = (t: string): Block => ({ type: 'text', text: t });
const toolUse = (id: string, input: unknown): Block => ({
  type: 'tool_use',
  id,
  name: 'search_products',
  input,
});

// Stand-in for anthropic.messages.stream(): iterable text deltas + finalMessage().
function fakeStream(content: Block[], stopReason: string) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const block of content)
        if (block.type === 'text')
          yield {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: block.text },
          };
    },
    finalMessage: () =>
      Promise.resolve({
        content,
        stop_reason: stopReason,
        usage: { input_tokens: 100, output_tokens: 10 },
      }),
  };
}

function createAgent() {
  const stream = vi.fn();
  const execute = vi.fn(() =>
    Promise.resolve({ content: '[]', products: [card('A1'), card('B2')] }),
  );
  const anthropic = { messages: { stream } } as unknown as Anthropic;
  const tools = { definitions: [], execute } as unknown as ProductToolsService;
  const config = {
    get: (_key: string, fallback: unknown) => fallback,
  } as unknown as ConfigService;
  return { agent: new AgentService(anthropic, tools, config), stream, execute };
}

async function collect(
  events: AsyncIterable<AgentEvent>,
): Promise<AgentEvent[]> {
  const out: AgentEvent[] = [];
  for await (const e of events) out.push(e);
  return out;
}

describe('recommendedCards', () => {
  it('keeps only recommended ids that tools returned, in mention order', () => {
    const found = new Map([
      ['A1', card('A1')],
      ['B2', card('B2')],
      ['C3', card('C3')],
    ]);
    const answer =
      'Try **B** [product:B2] or **A** [product:A1]. B again [product:B2]. Made up [product:ZZ9].';
    expect(recommendedCards(answer, found).map((c) => c.id)).toEqual([
      'B2',
      'A1',
    ]);
  });
});

describe('AgentService.stream', () => {
  beforeAll(() => Logger.overrideLogger(false));

  it('runs a tool, then streams the answer with its product cards', async () => {
    const { agent, stream, execute } = createAgent();
    stream
      .mockReturnValueOnce(
        fakeStream([toolUse('tu_1', { query: 'bracelet' })], 'tool_use'),
      )
      .mockReturnValueOnce(
        fakeStream([text('Get this one [product:B2].')], 'end_turn'),
      );

    const events = await collect(
      agent.stream([{ role: 'user', content: 'gift' }]),
    );

    expect(events.map((e) => e.type)).toEqual([
      'tool',
      'text',
      'products',
      'done',
    ]);
    expect(execute).toHaveBeenCalledWith('search_products', {
      query: 'bracelet',
    });
    expect(events[2]).toEqual({ type: 'products', products: [card('B2')] });
    expect(events[3]).toMatchObject({
      type: 'done',
      stopReason: 'end_turn',
      iterations: 2,
      usage: { inputTokens: 200, outputTokens: 20 },
    });
    // The second request sends the tool result back to Claude.
    const [params] = stream.mock.calls[1] as [Anthropic.MessageCreateParams];
    expect(params.messages.at(-1)).toEqual({
      role: 'user',
      content: [
        expect.objectContaining({ type: 'tool_result', tool_use_id: 'tu_1' }),
      ],
    });
  });

  it('stops after MAX_ITERATIONS when Claude keeps calling tools', async () => {
    const { agent, stream } = createAgent();
    stream.mockImplementation(() =>
      fakeStream([toolUse('tu', { query: 'x' })], 'tool_use'),
    );

    const events = await collect(
      agent.stream([{ role: 'user', content: 'loop' }]),
    );

    expect(stream).toHaveBeenCalledTimes(6);
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      stopReason: 'max_iterations',
      iterations: 6,
    });
    expect(events.some((e) => e.type === 'products')).toBe(false);
  });

  it('aborts the in-flight Claude request when the client disconnects', async () => {
    const { agent, stream, execute } = createAgent();
    stream.mockReturnValueOnce(
      fakeStream([toolUse('tu_1', { query: 'x' })], 'tool_use'),
    );

    const events = agent.stream([{ role: 'user', content: 'gift' }]);
    await events.next(); // first 'tool' event
    await events.return(undefined); // what Nest does when the connection closes

    const [, options] = stream.mock.calls[0] as [
      unknown,
      { signal: AbortSignal },
    ];
    expect(options.signal.aborted).toBe(true);
    expect(execute).not.toHaveBeenCalled();
  });
});

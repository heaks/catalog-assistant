
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChatHttpError, streamChat } from './chat'
import type { AgentEvent } from './types'

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
}

async function collect(events: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const out: AgentEvent[] = []
  for await (const e of events) out.push(e)
  return out
}

const send = () => streamChat([{ role: 'user', content: 'hi' }], new AbortController().signal)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('streamChat', () => {
  it('parses events split across network chunks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          sseResponse([
            'event: text\ndata: {"type":"text","del',
            'ta":"Hi"}\n\nevent: done\ndata: {"type":"done","stopReason":"end_turn","iterations":1,"costUsd":0.01}\n',
            '\n',
          ]),
        ),
      ),
    )
    expect(await collect(send())).toEqual([
      { type: 'text', delta: 'Hi' },
      { type: 'done', stopReason: 'end_turn', iterations: 1, costUsd: 0.01 },
    ])
  })

  it('throws ChatHttpError with Retry-After on 429', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ statusCode: 429, message: 'ThrottlerException: Too Many Requests' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json', 'Retry-After': '42' },
          }),
        ),
      ),
    )
    const error = await collect(send()).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ChatHttpError)
    expect(error).toMatchObject({ status: 429, retryAfterSec: 42 })
  })
})

import {
  BadRequestException,
  Body,
  Controller,
  Header,
  HttpCode,
  Logger,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import {
  AgentService,
  type AgentEvent,
  type ChatMessage,
} from './agent.service.js';

const MAX_HISTORY = 20;

const ChatRequest = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(100)
    .refine(
      (m) => m.at(-1)?.role === 'user',
      'the last message must be from the user',
    ),
});

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly agent: AgentService) {}

  @Post()
  @HttpCode(200)
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('X-Accel-Buffering', 'no')
  async *chat(@Body() body: unknown) {
    const parsed = ChatRequest.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(z.prettifyError(parsed.error));

    try {
      for await (const event of this.agent.stream(
        trimHistory(parsed.data.messages),
      )) {
        yield toSse(event);
      }
    } catch (err) {
      this.logger.error(err);
      yield toSse({
        type: 'error',
        message: 'The assistant is temporarily unavailable. Please try again.',
      });
    }
  }
}

// Keep the last messages to cap cost; the conversation must still start with a user turn.
function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  const recent = messages.slice(-MAX_HISTORY);
  const firstUser = recent.findIndex((m) => m.role === 'user');
  return recent.slice(firstUser);
}

function toSse(event: AgentEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

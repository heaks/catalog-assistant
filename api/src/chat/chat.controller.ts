import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { AgentService } from './agent.service.js';

@Controller('chat')
export class ChatController {
  constructor(private readonly agent: AgentService) {}

  @Post()
  async chat(@Body() body: { message?: string }) {
    const message = body?.message?.trim();
    if (!message) throw new BadRequestException('message is required');
    if (message.length > 2000)
      throw new BadRequestException('message is too long');
    return this.agent.run(message);
  }
}

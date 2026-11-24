import { Module } from '@nestjs/common';
import { SearchModule } from '../search/search.module.js';
import { AgentService } from './agent.service.js';
import { ChatController } from './chat.controller.js';
import { ProductToolsService } from './product-tools.service.js';

@Module({
  imports: [SearchModule],
  controllers: [ChatController],
  providers: [AgentService, ProductToolsService],
})
export class ChatModule {}

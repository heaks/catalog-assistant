import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health.controller.js';
import { EmbeddingsModule } from './embeddings/embeddings.module.js';
import { IngestModule } from './ingest/ingest.module.js';
import { SearchModule } from './search/search.module.js';
import { ChatModule } from './chat/chat.module.js';
import { ClaudeModule } from './claude/claude.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.getOrThrow<string>('REDIS_URL'));
        return {
          connection: { host: url.hostname, port: Number(url.port || 6379) },
        };
      },
    }),
    DbModule,
    EmbeddingsModule,
    IngestModule,
    SearchModule,
    ChatModule,
    ClaudeModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60_000,
            limit: Number(config.get('CHAT_LIMIT_PER_MINUTE', 10)),
          },
          {
            name: 'day',
            ttl: 86_400_000,
            limit: Number(config.get('CHAT_LIMIT_PER_DAY', 100)),
          },
        ],
      }),
    }),
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmbeddingsModule } from '../embeddings/embeddings.module.js';
import { INGEST_QUEUE } from './ingest.constants.js';
import { IngestController } from './ingest.controller.js';
import { IngestProcessor } from './ingest.processor.js';

@Module({
  imports: [BullModule.registerQueue({ name: INGEST_QUEUE }), EmbeddingsModule],
  controllers: [IngestController],
  providers: [IngestProcessor],
})
export class IngestModule {}

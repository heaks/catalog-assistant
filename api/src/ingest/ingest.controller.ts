import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import {
  INGEST_QUEUE,
  type IngestJobData,
  type IngestJobResult,
} from './ingest.constants.js';

const DEFAULT_LIMIT = 2000;
const MAX_LIMIT = 20000;

@Controller('ingest')
export class IngestController {
  constructor(
    @InjectQueue(INGEST_QUEUE)
    private readonly queue: Queue<IngestJobData, IngestJobResult>,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(202)
  async start(@Body() body: { limit?: number } = {}) {
    const limit = body.limit ?? DEFAULT_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new BadRequestException(
        `limit must be an integer between 1 and ${MAX_LIMIT}`,
      );
    }
    const path = this.config.get(
      'INGEST_CSV_PATH',
      '../data/raw/flipkart_com-ecommerce_sample.csv',
    );
    const job = await this.queue.add(
      'flipkart',
      { path, limit },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
    return { jobId: job.id };
  }

  @Get(':id')
  async status(@Param('id') id: string) {
    const job = await this.queue.getJob(id);
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return {
      id: job.id,
      state: await job.getState(),
      progress: job.progress,
      result: job.returnvalue,
      error: job.failedReason,
      attempts: job.attemptsMade,
    };
  }
}

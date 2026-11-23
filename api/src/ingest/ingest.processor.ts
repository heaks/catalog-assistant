import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { sql } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { products } from '../db/schema.js';
import { EmbeddingsService } from '../embeddings/embeddings.service.js';
import {
  readFlipkartCsv,
  toEmbeddingText,
  type ProductRecord,
} from './flipkart.parser.js';
import {
  INGEST_QUEUE,
  type IngestJobData,
  type IngestJobResult,
} from './ingest.constants.js';

const BATCH_SIZE = 64;

@Processor(INGEST_QUEUE, { concurrency: 1 })
export class IngestProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestProcessor.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly embeddings: EmbeddingsService,
  ) {
    super();
  }

  async process(job: Job<IngestJobData>): Promise<IngestJobResult> {
    const started = Date.now();
    let ingested = 0;
    let batch: ProductRecord[] = [];

    for await (const product of readFlipkartCsv(
      job.data.path,
      job.data.limit,
    )) {
      batch.push(product);
      if (batch.length === BATCH_SIZE) {
        ingested += await this.saveBatch(batch);
        batch = [];
        await job.updateProgress(ingested);
      }
    }
    if (batch.length > 0) {
      ingested += await this.saveBatch(batch);
      await job.updateProgress(ingested);
    }

    this.logger.log(
      `Job ${job.id}: ingested ${ingested} products in ${Date.now() - started}ms`,
    );
    return { ingested };
  }

  private async saveBatch(batch: ProductRecord[]): Promise<number> {
    const vectors = await this.embeddings.embed(batch.map(toEmbeddingText));
    const rows = batch.map((p, i) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      description: p.description,
      priceUsd: p.priceUsdCents,
      imageUrl: p.imageUrl,
      embedding: vectors[i],
    }));

    // Upsert keeps the job idempotent, so BullMQ retries and re-runs are safe.
    await this.db
      .insert(products)
      .values(rows)
      .onConflictDoUpdate({
        target: products.id,
        set: {
          name: sql`excluded.name`,
          brand: sql`excluded.brand`,
          category: sql`excluded.category`,
          description: sql`excluded.description`,
          priceUsd: sql`excluded.price_usd_cents`,
          imageUrl: sql`excluded.image_url`,
          embedding: sql`excluded.embedding`,
        },
      });
    return batch.length;
  }
}

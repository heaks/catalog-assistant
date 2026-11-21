import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
  vector,
} from 'drizzle-orm/pg-core';

export const products = pgTable(
  'products',
  {
    id: varchar('id', { length: 32 }).primaryKey(), // Flipkart pid
    name: text('name').notNull(),
    brand: text('brand'),
    category: text('category'), // e.g. "Clothing > Women's Clothing"
    description: text('description'),
    priceUsd: integer('price_usd_cents'), // discounted price converted from INR, in cents
    imageUrl: text('image_url'),
    embedding: vector('embedding', { dimensions: 384 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('products_embedding_hnsw').using(
      'hnsw',
      t.embedding.op('vector_cosine_ops'),
    ),
  ],
);

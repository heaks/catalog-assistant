import { createReadStream } from 'node:fs';
import { parse } from 'csv-parse';

export interface ProductRecord {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  priceUsdCents: number | null;
  imageUrl: string | null;
}

// Fixed rate keeps ingestion deterministic; prices are illustrative anyway.
const INR_PER_USD = 83;
const IMAGE_HOST = 'https://rukminim1.flixcart.com';
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_CATEGORY_DEPTH = 3;

export async function* readFlipkartCsv(
  path: string,
  limit = Infinity,
): AsyncGenerator<ProductRecord> {
  const rows = createReadStream(path).pipe(
    parse({ columns: true, skip_empty_lines: true, relax_quotes: true }),
  );
  const seen = new Set<string>();
  let count = 0;

  for await (const row of rows as AsyncIterable<Record<string, string>>) {
    const product = toProduct(row);
    if (!product || seen.has(product.id)) continue;
    seen.add(product.id);
    yield product;
    if (++count >= limit) break;
  }
}

export function toProduct(row: Record<string, string>): ProductRecord | null {
  const id = row.pid?.trim();
  const name = row.product_name?.trim();
  if (!id || !name) return null;

  return {
    id,
    name,
    brand: row.brand?.trim() || null,
    category: parseCategory(row.product_category_tree),
    description: cleanDescription(row.description),
    priceUsdCents:
      toUsdCents(row.discounted_price) ?? toUsdCents(row.retail_price),
    imageUrl: parseImage(row.image),
  };
}

export function toEmbeddingText(p: ProductRecord): string {
  return [
    p.name,
    p.brand && `Brand: ${p.brand}`,
    p.category && `Category: ${p.category}`,
    p.description,
  ]
    .filter(Boolean)
    .join('. ');
}

function parseJsonArray(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((v) => typeof v === 'string')
      : [];
  } catch {
    return [];
  }
}

// "Clothing >> Women's Clothing >> ... >> <product name>" -> "Clothing > Women's Clothing > ..."
function parseCategory(tree: string | undefined): string | null {
  const [path] = parseJsonArray(tree);
  const parts =
    path
      ?.split('>>')
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  // The last segment is usually the product itself, so it is never a category.
  if (parts.length < 2) return null;
  return parts
    .slice(0, Math.min(MAX_CATEGORY_DEPTH, parts.length - 1))
    .join(' > ');
}

function parseImage(images: string | undefined): string | null {
  const [first] = parseJsonArray(images);
  if (!first) return null;
  // Original img*.flixcart.com hosts are dead; the same paths are served from rukminim1.
  return first.replace(/^https?:\/\/[^/]+/, IMAGE_HOST);
}

function toUsdCents(inr: string | undefined): number | null {
  const value = Number(inr);
  if (!inr || !Number.isFinite(value) || value <= 0) return null;
  return Math.round((value / INR_PER_USD) * 100);
}

function cleanDescription(text: string | undefined): string | null {
  if (!text) return null;
  const cleaned = text
    .replace(/Key Features of|Specifications of|General Details/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  if (cleaned.length <= MAX_DESCRIPTION_LENGTH) return cleaned;
  const cut = cleaned.slice(0, MAX_DESCRIPTION_LENGTH);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}

export const INGEST_QUEUE = 'ingest';

export interface IngestJobData {
  path: string;
  limit: number;
}

export interface IngestJobResult {
  ingested: number;
}

import type { AgentEvent, ChatMessage } from './types'

export class ChatHttpError extends Error {
  readonly status: number
  readonly retryAfterSec: number | null

  constructor(status: number, message: string, retryAfterSec: number | null) {
    super(message)
    this.status = status
    this.retryAfterSec = retryAfterSec
  }
}

export async function* streamChat(
  messages: ChatMessage[],
  signal: AbortSignal,
): AsyncGenerator<AgentEvent> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  })

  // Guards (429) and validation (400) answer with JSON before the stream starts.
  if (!res.ok || !res.body) {
    const retry = res.headers.get('Retry-After') ?? res.headers.get('Retry-After-day')
    const body = await res.json().catch(() => null)
    throw new ChatHttpError(res.status, body?.message ?? res.statusText, retry ? Number(retry) : null)
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    // A network chunk can end mid-event: parse only complete "\n\n"-terminated events.
    let end: number
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      const data = raw
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n')
      if (data) yield JSON.parse(data) as AgentEvent
    }
  }
}

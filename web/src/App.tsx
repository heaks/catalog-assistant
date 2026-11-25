import { useEffect, useRef, useState } from 'react'
import { Message } from './Message'
import { useChat } from './useChat'
import './App.css'

const SUGGESTIONS = [
  'Gift for a girl under $20',
  "Men's running shoes",
  'Compare two analog watches under $30',
  'Something nice for a kitchen',
]

export default function App() {
  const { messages, streaming, send, stop } = useChat()
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const submit = (text: string) => {
    if (!text.trim() || streaming) return
    void send(text)
    setInput('')
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Catalog Assistant</h1>
        <p>Describe what you need. Answers come only from the catalog.</p>
      </header>

      <main className="messages">
        {messages.length === 0 && (
          <div className="empty">
            <p>What are you looking for?</p>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => submit(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Messages are append-only, so index keys are stable. */}
        {messages.map((m, i) => (
          <Message key={i} message={m} />
        ))}
        <div ref={endRef} />
      </main>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          submit(input)
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. a warm jacket for a 5-year-old"
          maxLength={4000}
          autoFocus
        />
        {streaming ? (
          <button type="button" onClick={stop}>
            Stop
          </button>
        ) : (
          <button className="primary" disabled={!input.trim()}>
            Send
          </button>
        )}
      </form>
    </div>
  )
}

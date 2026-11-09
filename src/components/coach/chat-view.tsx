'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ProposalCard as ProposalCardData } from '@/modules/coach-ai'
import { ProposalCard } from './proposal-card'
import { QuickChips } from './quick-chips'

type Message = { role: 'user' | 'assistant'; content: string }

type Props = {
  initialConversationId: string | null
  initialMessages: Message[]
  initialProposals: ProposalCardData[]
  prefill: string | null
}

const HINT = 'Максим видит предложения, изменения в плане и сообщения о боли или травме'

/** Чат МаксИИма (DESIGN.md §8.6). */
export function ChatView({ initialConversationId, initialMessages, initialProposals, prefill }: Props) {
  const [conversationId, setConversationId] = useState(initialConversationId)
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [proposals, setProposals] = useState<ProposalCardData[]>(initialProposals)
  const [input, setInput] = useState(prefill ?? '')
  const [streaming, setStreaming] = useState(false)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!prefill) return
    inputRef.current?.focus()
  }, [prefill])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function replaceLast(message: Message): void {
    setMessages((current) => [...current.slice(0, -1), message])
  }

  async function loadProposals(id: string | null): Promise<void> {
    if (!id) return

    // Первый запрос в dev может совпасть с компиляцией роута — пробуем ещё раз.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(`/api/coach/proposals?conversationId=${id}`)
        if (response.ok) {
          const body = (await response.json()) as { proposals: ProposalCardData[] }
          setProposals(body.proposals)
          return
        }
      } catch {
        // сеть/компиляция — повторим
      }

      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  async function send(): Promise<void> {
    const text = input.trim()
    if (!text || streaming) return

    setError(null)
    setInput('')
    setStreaming(true)
    setMessages((current) => [
      ...current,
      { role: 'user', content: text },
      { role: 'assistant', content: '' },
    ])

    try {
      const response = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId, text }),
      })

      const nextConversationId = response.headers.get('x-coach-conversation-id') ?? conversationId
      if (nextConversationId) setConversationId(nextConversationId)

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        replaceLast({ role: 'assistant', content: body?.error ?? 'Не удалось ответить' })
        setStreaming(false)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        replaceLast({ role: 'assistant', content: await response.text() })
        setStreaming(false)
        return
      }

      const decoder = new TextDecoder()
      let answer = ''

      for (;;) {
        const chunk = await reader.read()
        if (chunk.done) break
        answer += decoder.decode(chunk.value, { stream: true })
        replaceLast({ role: 'assistant', content: answer })
      }

      replaceLast({ role: 'assistant', content: answer })
      await loadProposals(nextConversationId)
    } catch {
      replaceLast({ role: 'assistant', content: 'Нет сети. Попробуй ещё раз' })
    } finally {
      setStreaming(false)
    }
  }

  async function decide(id: string, action: 'accept' | 'reject'): Promise<void> {
    setError(null)
    const response = await fetch(`/api/coach/proposals/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    })

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      setError(body?.error ?? 'Не удалось применить')
      return
    }

    await loadProposals(conversationId)
    router.refresh()
  }

  async function startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      const chunks: Blob[] = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        setRecording(false)

        const form = new FormData()
        form.append('audio', new Blob(chunks, { type: mime }), mime === 'audio/mp4' ? 'voice.mp4' : 'voice.webm')

        try {
          const response = await fetch('/api/coach/voice', { method: 'POST', body: form })
          if (!response.ok) {
            setError('Не удалось распознать речь')
            return
          }
          const body = (await response.json()) as { text?: string }
          if (body.text) setInput((current) => (current ? `${current} ${body.text}` : body.text!))
        } catch {
          setError('Не удалось распознать речь')
        }
      }

      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
      setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop()
      }, 120_000)
    } catch {
      setError('Нет доступа к микрофону')
    }
  }

  function toggleRecording(): void {
    if (recording) recorderRef.current?.stop()
    else void startRecording()
  }
return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-bg px-4 py-3">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-accent font-display text-[18px] text-white">
          М
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-accent" />
        </div>
        <div className="flex flex-col">
          <p className="text-[17px] font-semibold leading-tight">МаксИИм</p>
          <p className="text-[13px] text-text-muted">ИИ-помощник Максима</p>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        <p className="text-[13px] text-text-muted">{HINT}</p>

        {messages.map((message, index) =>
          message.role === 'assistant' ? (
            <div key={index} className="max-w-[88%] self-start text-[15px] text-text">
              {message.content || (streaming && index === messages.length - 1 ? 'Печатает…' : '')}
            </div>
          ) : (
            <div
              key={index}
              className="max-w-[88%] self-end rounded-card bg-surface-2 px-3 py-2 text-[15px] text-text"
            >
              {message.content}
            </div>
          ),
        )}

        {proposals.map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} onDecide={decide} />
        ))}

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 border-t border-border bg-bg px-4 py-3">
        <QuickChips
          onPick={(text) => {
            setInput(text)
            inputRef.current?.focus()
          }}
        />

        <div className="mt-2 flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send()
              }
            }}
            placeholder="Спроси МаксИИма"
            aria-label="Сообщение МаксИИму"
            className="min-h-12 flex-1 resize-none rounded-control border border-border bg-surface-1 px-3 py-3 text-[15px] text-text outline-none focus-visible:border-accent"
          />

          <Button
            type="button"
            variant="secondary"
            className="h-12 w-12 p-0"
            aria-label={recording ? 'Остановить запись' : 'Наговорить вопрос'}
            onClick={toggleRecording}
          >
            {recording ? <Square size={18} /> : <Mic size={20} />}
          </Button>

          <Button
            type="button"
            className="h-12"
            disabled={!input.trim() || streaming}
            onClick={() => void send()}
          >
            {streaming ? 'Отвечает…' : 'Отправить'}
          </Button>
        </div>
      </div>
    </div>
  )
}
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowUp, Mic, Square } from 'lucide-react'
import type { ProposalCard as ProposalCardData } from '@/modules/coach-ai'
import { ProposalCard } from './proposal-card'
import { QuickChips } from './quick-chips'
import { RichText } from './rich-text'

const STARTERS = [
  { title: 'Собери тренировку', hint: 'Под твою цель и время', text: 'Собери тренировку' },
  { title: 'Разбор недели', hint: 'Что получилось, что подтянуть', text: 'Разбор недели' },
  { title: 'Почему такой вес?', hint: 'Объясню рекомендацию', text: 'Почему такой вес?' },
  { title: 'Чем заменить упражнение', hint: 'Подберу из зала Колизей', text: 'Чем заменить ' },
] as const

function Avatar({ size = 32 }: { size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-accent font-display text-[15px] text-white"
    >
      М
    </span>
  )
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="МаксИИм печатает">
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className="h-2 w-2 animate-pulse rounded-full bg-text-muted"
          style={{ animationDelay: `${dot * 180}ms` }}
        />
      ))}
    </span>
  )
}

type Message = { role: 'user' | 'assistant'; content: string }

type Props = {
  initialConversationId: string | null
  initialMessages: Message[]
  initialProposals: ProposalCardData[]
  prefill: string | null
}

/** Высота и сдвиг видимой области: с клавиатурой чат занимает только то, что осталось над ней. */
function useVisualViewport(): { height: number | null; top: number } {
  const [state, setState] = useState<{ height: number | null; top: number }>({ height: null, top: 0 })

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const update = (): void => setState({ height: viewport.height, top: viewport.offsetTop })
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])

  return state
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
  const viewport = useVisualViewport()

  useEffect(() => {
    if (!prefill) return
    inputRef.current?.focus()
  }, [prefill])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, viewport.height])

  // Поле растёт вместе с текстом (до 5 строк), а не прячет его.
  useEffect(() => {
    const element = inputRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 128)}px`
  }, [input])

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
    // Чат — отдельный полноэкранный экран (как в мессенджерах): без нижнего меню,
    // над клавиатурой остаются шапка, переписка и поле ввода.
    <div
      className="fixed inset-x-0 z-30 flex flex-col bg-bg"
      style={{ top: viewport.top, height: viewport.height ?? '100dvh' }}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-bg px-2 py-2">
        <Link
          href="/"
          aria-label="Назад"
          className="flex h-11 w-11 items-center justify-center rounded-full text-text-secondary"
        >
          <ArrowLeft size={22} />
        </Link>
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-accent font-display text-[18px] text-white">
          М
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-accent" />
        </div>
        <div className="flex flex-col">
          <p className="text-[17px] font-semibold leading-tight">МаксИИм</p>
          <p className="text-[13px] text-text-muted">ИИ-помощник Максима</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col justify-center gap-5 py-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <Avatar size={64} />
              <h1 className="text-[22px] font-semibold">Привет! Я МаксИИм</h1>
              <p className="max-w-[280px] text-[15px] text-text-secondary">
                Помогу с тренировкой, весами и техникой. Только упражнения из зала Колизей
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {STARTERS.map((starter) => (
                <button
                  key={starter.title}
                  type="button"
                  onClick={() => {
                    setInput(starter.text)
                    inputRef.current?.focus()
                  }}
                  className="flex min-h-[84px] flex-col items-start gap-1 rounded-card border border-border bg-surface-1 p-3 text-left active:bg-surface-2"
                >
                  <span className="text-[15px] font-medium leading-tight">{starter.title}</span>
                  <span className="text-[13px] leading-snug text-text-muted">{starter.hint}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-center text-[12px] text-text-muted">{HINT}</p>
        )}

        {messages.map((message, index) =>
          message.role === 'assistant' ? (
            <div key={index} className="flex max-w-[92%] items-start gap-2 self-start">
              <Avatar />
              <div className="rounded-[18px] rounded-tl-[6px] bg-surface-1 px-3.5 py-2.5 text-[16px] leading-snug text-text">
                {message.content ? (
                  <RichText text={message.content} />
                ) : streaming && index === messages.length - 1 ? (
                  <TypingDots />
                ) : null}
              </div>
            </div>
          ) : (
            <div
              key={index}
              className="max-w-[85%] self-end whitespace-pre-wrap rounded-[18px] rounded-br-[6px] bg-accent px-3.5 py-2.5 text-[16px] leading-snug text-white"
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

      <div className="shrink-0 border-t border-border bg-bg px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2">
        {input.trim() || messages.length === 0 ? null : (
          <div className="mb-2">
            <QuickChips
              onPick={(text) => {
                setInput(text)
                inputRef.current?.focus()
              }}
            />
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            enterKeyHint="send"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send()
              }
            }}
            placeholder="Спроси МаксИИма…"
            aria-label="Сообщение МаксИИму"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-[22px] border border-border bg-surface-1 px-4 py-[10px] text-[16px] leading-6 text-text outline-none focus-visible:border-accent"
          />

          {input.trim() ? (
            <button
              type="button"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-50"
              disabled={streaming}
              aria-label="Отправить"
              onClick={() => void send()}
            >
              <ArrowUp size={22} />
            </button>
          ) : (
            <button
              type="button"
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                recording ? 'bg-accent text-white' : 'bg-surface-2 text-text'
              }`}
              aria-label={recording ? 'Остановить запись' : 'Наговорить вопрос'}
              onClick={toggleRecording}
            >
              {recording ? <Square size={18} /> : <Mic size={20} />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

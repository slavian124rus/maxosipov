import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { queryDb } from './db'

const PORT = 4010

type ChatBody = {
  model?: string
  stream?: boolean
  messages?: { role: string; content?: unknown }[]
}

async function replacement(): Promise<{ programExerciseId: string; exerciseId: string } | null> {
  const rows = await queryDb<{ program_exercise_id: string; replacement_id: string }>(
    `select pe.id as program_exercise_id, e2.id as replacement_id
       from program_exercises pe
       join exercises e on e.id = pe.exercise_id
       join program_days pd on pd.id = pe.day_id
       join programs p on p.id = pd.program_id
       join users u on u.id = p.owner_id
       cross join (select id from exercises where slug = 'zhim-nogami' limit 1) e2
      where u.phone = '+79990000011'
        and p.status = 'active'
        and e.slug = 'tyaga-gorizontalnogo-bloka'
      limit 1`,
  )

  const row = rows[0]
  return row ? { programExerciseId: row.program_exercise_id, exerciseId: row.replacement_id } : null
}

function chunk(delta: Record<string, unknown>, finishReason: string | null, usage?: unknown): string {
  const payload: Record<string, unknown> = {
    id: 'chatcmpl-e2e',
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: 'fake-main',
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  }
  if (usage) payload.usage = usage

  return `data: ${JSON.stringify(payload)}\n\n`
}

async function sse(body: ChatBody, response: ServerResponse): Promise<void> {
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  })

  const usage = { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 }
  const last = body.messages?.[body.messages.length - 1]
  const isToolResult = last?.role === 'tool'
  const userText = JSON.stringify(body.messages ?? [])

  response.write(chunk({ role: 'assistant', content: '' }, null))

  if (!isToolResult && userText.includes('Замени')) {
    const target = await replacement()

    if (target) {
      const args = JSON.stringify({
        patch: {
          ops: [
            {
              op: 'replace_exercise',
              programExerciseId: target.programExerciseId,
              exerciseId: target.exerciseId,
            },
          ],
        },
        rationale: 'Замена на жим ногами — та же нагрузка, проще техника',
      })

      response.write(
        chunk(
          {
            tool_calls: [
              {
                index: 0,
                id: 'call_e2e_1',
                type: 'function',
                function: { name: 'propose_program_change', arguments: args },
              },
            ],
          },
          null,
        ),
      )
      response.write(chunk({}, 'tool_calls', usage))
      response.write('data: [DONE]\n\n')
      response.end()
      return
    }
  }

  const answer = isToolResult
    ? 'Готово: посмотри карточку «Что изменится» и нажми «Принять».'
    : 'Ставь 40 кг — работай чисто, без рывков.'

  for (const word of answer.split(' ')) {
    response.write(chunk({ content: `${word} ` }, null))
  }

  response.write(chunk({}, 'stop', usage))
  response.write('data: [DONE]\n\n')
  response.end()
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    request.on('data', (part) => {
      data += part
    })
    request.on('end', () => resolve(data))
    request.on('error', reject)
  })
}

/** Фейковый OpenAI-совместимый сервер для e2e: заранее записанные ответы и вызов инструмента. */
createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ ok: true }))
    return
  }

  if (request.method === 'POST' && request.url?.endsWith('/chat/completions')) {
    const raw = await readBody(request)
    let body: ChatBody = {}
    try {
      body = JSON.parse(raw) as ChatBody
    } catch {
      response.writeHead(400).end('bad json')
      return
    }

    try {
      await sse(body, response)
    } catch (error) {
      response.writeHead(500).end(String(error))
    }
    return
  }

  response.writeHead(404).end('not found')
}).listen(PORT, '127.0.0.1', () => {
  console.log(`[fake-ai] http://127.0.0.1:${PORT}`)
})
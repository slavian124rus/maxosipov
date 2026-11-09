import { expect, test } from 'vitest'
import { renderNotification } from './templates'

test('sub_ends_3d — текст из плана', () => {
  expect(renderNotification('sub_ends_3d')).toEqual({
    title: 'Подписка заканчивается',
    body: 'Осталось 3 дня. Продли у Максима, чтобы не прерываться',
    url: '/profile',
    push: true,
  })
})

test('sub_ended — текст из плана', () => {
  expect(renderNotification('sub_ended')).toEqual({
    title: 'Подписка закончилась',
    body: 'Продли у Максима — и продолжаем',
    url: '/paywall',
    push: true,
  })
})

test('program_updated — текст из плана', () => {
  expect(renderNotification('program_updated')).toEqual({
    title: 'Максим обновил программу',
    body: 'Загляни перед тренировкой',
    url: '/workouts',
    push: true,
  })
})

test('client_pain — имя, первые 80 символов и ссылка на вкладку «МаксИИм»', () => {
  const text = 'болит колено, '.repeat(10)
  const rendered = renderNotification('client_pain', {
    name: 'Иван Петров',
    text,
    clientId: 'c1',
  })

  expect(rendered.title).toBe('Иван Петров: жалоба на боль')
  expect(rendered.body).toHaveLength(80)
  expect(rendered.url).toBe('/trainer/clients/c1?tab=coach')
  expect(rendered.push).toBe(true)
})

test('ai_change_accepted — без push', () => {
  const rendered = renderNotification('ai_change_accepted', {
    name: 'Иван Петров',
    line: 'Добавлено: Тяга верхнего блока, 3 подхода · 10–12 раз',
    clientId: 'c1',
  })

  expect(rendered.title).toBe('Иван Петров принял изменение МаксИИма')
  expect(rendered.body).toBe('Добавлено: Тяга верхнего блока, 3 подхода · 10–12 раз')
  expect(rendered.url).toBe('/trainer/clients/c1?tab=program')
  expect(rendered.push).toBe(false)
})

test('new_client — дата пробного периода по Красноярску', () => {
  const rendered = renderNotification(
    'new_client',
    { name: 'Мария Соколова', clientId: 'c2', trialUntil: '2026-12-07T00:00:00.000Z' },
    { now: new Date('2026-11-09T00:00:00.000Z') },
  )

  expect(rendered.title).toBe('Новый клиент')
  expect(rendered.body).toBe('Мария Соколова, пробный период до 7 декабря')
  expect(rendered.url).toBe('/trainer/clients/c2')
  expect(rendered.push).toBe(true)
})

test('new_lead — имя и телефон', () => {
  expect(renderNotification('new_lead', { name: 'Олег', phone: '+7 999 000-00-00' })).toEqual({
    title: 'Заявка с сайта',
    body: 'Олег, +7 999 000-00-00',
    url: '/trainer/leads',
    push: true,
  })
})

test('trainer_daily — пустую сводку не отправляем', () => {
  expect(renderNotification('trainer_daily', { expiring: 2, pain: 1 })).toEqual({
    title: 'Сводка на сегодня',
    body: 'Заканчивается доступ: 2. Жалоб: 1',
    url: '/trainer',
    push: true,
  })

  expect(renderNotification('trainer_daily', { expiring: 0, pain: 0 }).push).toBe(false)
})
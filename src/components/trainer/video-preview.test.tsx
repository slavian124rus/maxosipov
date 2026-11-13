// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { VideoPreview, VideoProcessing } from './video-preview'

afterEach(cleanup)

test('видео в обработке показывает крутилку с подписью, а не голый текст', () => {
  const { container } = render(
    <VideoPreview
      file={null}
      current={{ status: 'processing', mp4Url: null, webmUrl: null, posterUrl: null }}
    />,
  )
  const status = screen.getByRole('status')
  expect(status.textContent).toContain('Видео обрабатывается')
  expect(container.querySelector('[data-loader]')).toBeTruthy()
})

test('VideoProcessing можно показать отдельно, например вместо ошибки публикации', () => {
  render(<VideoProcessing />)
  expect(screen.getByRole('status')).toBeTruthy()
})

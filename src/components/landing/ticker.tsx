type Props = { items: readonly string[] }

/**
 * Бегущая строка под первым экраном: короткие обещания продукта. Для скринридеров —
 * обычный список (копия для зацикливания скрыта), при `prefers-reduced-motion` не движется.
 */
export function Ticker({ items }: Props) {
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-center font-display text-[20px] font-medium whitespace-nowrap text-text md:text-[26px]"
        >
          <span className="px-6 md:px-8">{item}</span>
          <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
        </li>
      ))}
    </ul>
  )

  return (
    <div id="ticker" className="overflow-hidden border-y border-border bg-surface-1/60 py-4 md:py-5">
      <div className="flex w-max motion-safe:animate-[marquee_38s_linear_infinite]">
        {row(false)}
        {row(true)}
      </div>
    </div>
  )
}

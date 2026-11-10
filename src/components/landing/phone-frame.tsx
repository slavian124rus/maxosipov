type Props = {
  src: string
  alt: string
  /** Красное свечение за корпусом — как в макете `prototypes/exercise-card`. */
  glow?: boolean
  className?: string
}

/**
 * Макет телефона для скриншотов приложения (план, задача 1, шаг 2).
 * Корпус, рамка и «остров» — как в `prototypes/exercise-card/index.html`,
 * но в относительных размерах, чтобы макет сжимался под мобильную сетку.
 */
export function PhoneFrame({ src, alt, glow, className }: Props) {
  return (
    <div className={`relative w-full max-w-[268px] ${className ?? ''}`}>
      {glow ? (
        <div
          aria-hidden="true"
          className="absolute -inset-x-8 -inset-y-6 -z-10 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(229,50,45,.28),transparent_70%)] blur-2xl"
        />
      ) : null}

      <div className="rounded-[36px] border border-[#2C2C31] bg-[#1B1B1E] p-[7px] shadow-[0_40px_80px_-24px_rgba(0,0,0,.85)]">
        <div className="relative aspect-[390/844] w-full overflow-hidden rounded-[30px] bg-bg">
          <span
            aria-hidden="true"
            className="absolute top-[7px] left-1/2 z-20 h-[18px] w-[62px] -translate-x-1/2 rounded-full bg-black"
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- статичный WebP из public/, оптимизатор не нужен */}
          <img
            src={src}
            alt={alt}
            width={780}
            height={1688}
            loading="lazy"
            decoding="async"
            className="size-full object-cover object-top"
          />
        </div>
      </div>
    </div>
  )
}

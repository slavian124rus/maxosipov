type Screen = { src: string; alt: string }

type Props = {
  /** Экраны лежат стопкой, виден один (`activeIndex`): переключение — плавное, без прыжков. */
  screens: Screen[]
  activeIndex: number
  className?: string
}

/**
 * Макет телефона для скриншотов приложения. Корпус, рамка и «остров» — как в
 * `prototypes/exercise-card/index.html`, но в относительных размерах.
 */
export function PhoneFrame({ screens, activeIndex, className }: Props) {
  return (
    <div className={`relative w-full max-w-[268px] ${className ?? ''}`}>
      <div className="rounded-[36px] border border-[#2C2C31] bg-[#1B1B1E] p-[7px] shadow-[0_40px_80px_-24px_rgba(0,0,0,.85)]">
        <div className="relative aspect-[390/844] w-full overflow-hidden rounded-[30px] bg-bg">
          <span
            aria-hidden="true"
            className="absolute top-[7px] left-1/2 z-20 h-[18px] w-[62px] -translate-x-1/2 rounded-full bg-black"
          />
          {screens.map((screen, index) => (
            /* eslint-disable-next-line @next/next/no-img-element -- статичный WebP из public/, оптимизатор не нужен */
            <img
              key={screen.src}
              src={screen.src}
              alt={index === activeIndex ? screen.alt : ''}
              aria-hidden={index === activeIndex ? undefined : true}
              width={780}
              height={1688}
              loading="lazy"
              decoding="async"
              className={`absolute inset-0 size-full object-cover object-top transition-all duration-500 ${
                index === activeIndex ? 'scale-100 opacity-100' : 'scale-[1.03] opacity-0'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

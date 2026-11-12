/**
 * Каталог зала «Колизей» (ул. Говорова, Красноярск), собранный по фото из папки
 * «ФОТО ЗАЛА/» (photo_2026-10-16_*.jpg). Видео пока нет: в карточке упражнения
 * вместо плеера показывается фото тренажёра с подписью «Видео скоро».
 *
 * Правила:
 * - тренажёры названы описательно, без выдуманных моделей — по тому, что видно на кадре;
 * - мышцы — только коды из `src/modules/catalog/muscles.ts` (тип `MuscleCode`);
 * - шаги 3–5, ошибки 2–3, тексты на «ты» и короткие (DESIGN.md §9, стиль `scripts/seed-catalog.ts`);
 * - `needsReview: true` — запись остаётся черновиком даже при `catalog:import --publish`.
 *   Флаг ставится, когда опознание тренажёра по кадру неоднозначно или кадр пришлось
 *   кроить, чтобы убрать людей. Снимает флаг только человек, который посмотрел фото.
 *
 * Кадры, которые НЕ используются (см. `docs/reports/08-report.md`):
 * - `XXXL.webp` и оба «Снимок экрана…png» — чужие фото с 2GIS;
 * - кадры, где люди или отражения в зеркалах не убираются кропом.
 */
import type { MuscleCode } from '@/modules/catalog'
import { EXTRA_EXERCISES, EXTRA_MACHINES } from './extra'

/** Кадр в пикселях исходника 960×1280. `null` — берём кадр целиком. */
export type CatalogPhotoCrop = {
  left: number
  top: number
  width: number
  height: number
}

export type CatalogPhoto = {
  /** Имя файла в «ФОТО ЗАЛА/» — папка только для чтения. */
  file: string
  /** Кроп, которым из кадра убраны люди. Считан `media-tools/people.py`. */
  crop: CatalogPhotoCrop | null
}

export type CatalogMachine = {
  /** Идентификатор тренажёра — он же имя файла фото в `content/catalog/photos/`. */
  slug: string
  name: string
  zone: string
  /** Шаг блина: 5 кг у стоек и рычажных, 2,5 кг у блочных (ARCHITECTURE.md §7). */
  weightStepKg: number
  photo: CatalogPhoto | null
  /** Кадр или опознание тренажёра требуют глаза человека. */
  needsReview?: boolean
  reviewNote?: string
}

export type CatalogExercise = {
  slug: string
  name: string
  /** `CatalogMachine.slug` — тренажёр упражнения. */
  machine: string
  primary: MuscleCode[]
  secondary: MuscleCode[]
  steps: string[]
  mistakes: string[]
  tips: string | null
  defaultRepMin: number
  defaultRepMax: number
  /** Подсветка мышц на видео делается только по ролику; пока видео нет — всегда `none`. */
  overlayProfile: 'none'
  /** Текст или привязка к тренажёру требуют проверки человеком. */
  needsReview?: boolean
  reviewNote?: string
}

const BASE_MACHINES: CatalogMachine[] = [
  {
    slug: 'zhim-nogami-45',
    name: 'Жим ногами 45°',
    zone: 'Ноги',
    weightStepKg: 5,
    photo: { file: 'photo_2026-10-16_21-46-50.jpg', crop: null },
  },
  {
    slug: 'gakk-mashina',
    name: 'Гакк-машина',
    zone: 'Ноги',
    weightStepKg: 5,
    photo: { file: 'photo_2026-10-16_21-46-51.jpg', crop: null },
  },
  {
    slug: 'babochka',
    name: 'Тренажёр «Бабочка»',
    zone: 'Грудь',
    weightStepKg: 2.5,
    photo: { file: 'photo_2026-10-16_21-46-54.jpg', crop: null },
    reviewNote: 'Проверить, что подушки переставляются и для обратных махов',
  },
  {
    slug: 'tyaga-verkhnego-bloka',
    name: 'Тренажёр для тяги верхнего блока',
    zone: 'Спина',
    weightStepKg: 2.5,
    photo: { file: 'photo_2026-10-16_21-46-56.jpg', crop: null },
  },
  {
    slug: 'sgibanie-nog-lyozha',
    name: 'Тренажёр для сгибания ног лёжа',
    zone: 'Ноги',
    weightStepKg: 5,
    photo: { file: 'photo_2026-10-16_21-47-01.jpg', crop: null },
  },
  {
    slug: 'svedenie-razvedenie-nog',
    name: 'Тренажёр для сведения и разведения ног',
    zone: 'Ноги',
    weightStepKg: 5,
    photo: { file: 'photo_2026-10-16_21-46-26.jpg', crop: null },
    needsReview: true,
    reviewNote:
      'В таблице кадр описан как «сведение/разведение» — подтвердить, что тренажёр делает оба движения',
  },
  {
    slug: 'sgibanie-nog-sidya',
    name: 'Тренажёр для сгибания ног сидя',
    zone: 'Ноги',
    weightStepKg: 5,
    // Детектор позы ошибочно нашёл человека: на кадре людей нет, берём его целиком.
    photo: { file: 'photo_2026-10-16_21-46-27.jpg', crop: null },
    needsReview: true,
    reviewNote: 'Проверить, что это именно сгибание ног сидя, а не разгибание',
  },
  {
    slug: 'rychazhnaya-tyaga-s-uporom-v-grud',
    name: 'Рычажная тяга с упором в грудь',
    zone: 'Спина',
    weightStepKg: 5,
    photo: { file: 'photo_2026-10-16_21-46-30.jpg', crop: null },
    needsReview: true,
    reviewNote: 'В таблице помечено «уточнить»: подтвердить, что это тяга с упором в грудь',
  },
  {
    slug: 'parta-dlya-bicepsa',
    name: 'Парта для бицепса',
    zone: 'Руки',
    weightStepKg: 2.5,
    photo: { file: 'photo_2026-10-16_21-46-31.jpg', crop: null },
    needsReview: true,
    reviewNote: 'В таблице помечено «уточнить»: подтвердить, что это бицепс-машина с партой',
  },
  {
    slug: 'blochnyy-zhim-ot-plech',
    name: 'Блочный жим от плеч сидя',
    zone: 'Плечи',
    weightStepKg: 2.5,
    // Детектор ошибочно нашёл человека: на кадре людей нет, берём его целиком.
    photo: { file: 'photo_2026-10-16_21-46-31 (2).jpg', crop: null },
    needsReview: true,
    reviewNote: 'Проверить, что это жим от плеч, а не другой блочный тренажёр',
  },
  {
    slug: 'trenazhyor-dlya-tricepsa',
    name: 'Тренажёр для разгибания рук',
    zone: 'Руки',
    weightStepKg: 2.5,
    photo: { file: 'photo_2026-10-16_21-46-32.jpg', crop: null },
    needsReview: true,
    reviewNote: 'В таблице помечено «уточнить»: подтвердить, что это трицепс-машина',
  },
  {
    slug: 'rychazhnyy-trenazhyor-dlya-nog',
    name: 'Рычажный тренажёр для ног',
    zone: 'Ноги',
    weightStepKg: 5,
    photo: { file: 'photo_2026-10-16_21-46-41.jpg', crop: null },
    needsReview: true,
    reviewNote: 'В таблице помечено «уточнить»: разгибание или сгибание ног — подтвердить по фото',
  },
  {
    slug: 'rychazhnaya-mashina-s-platformoy',
    name: 'Рычажная машина с платформой',
    zone: 'Ноги',
    weightStepKg: 5,
    photo: { file: 'photo_2026-10-16_21-46-42.jpg', crop: null },
    needsReview: true,
    reviewNote: 'В таблице помечено «уточнить»: присед или тяга — подтвердить по фото',
  },
  {
    slug: 'skamya-dlya-pressa',
    name: 'Скамья для пресса',
    zone: 'Пресс',
    weightStepKg: 5,
    photo: { file: 'photo_2026-10-16_21-46-46.jpg', crop: null },
    needsReview: true,
    reviewNote:
      'На кадре ряд скамей для пресса и гиперэкстензии — подтвердить, что это наклонная скамья для пресса',
  },
  {
    slug: 'brusnya-s-uporom-na-loktyakh',
    name: 'Брусья с упором на локтях',
    zone: 'Пресс',
    weightStepKg: 5,
    photo: { file: 'photo_2026-10-16_21-46-48.jpg', crop: null },
    needsReview: true,
    reviewNote:
      'Сборный кадр: упор на локтях, брусья и рядом кроссовер — подтвердить, что нужный тренажёр в кадре',
  },
  {
    slug: 'silovaya-rama',
    name: 'Силовая рама',
    zone: 'Свободные веса',
    weightStepKg: 5,
    photo: { file: 'photo_2026-10-16_21-46-52.jpg', crop: null },
    needsReview: true,
    reviewNote: 'Общий план стоек и помоста — подтвердить, что кадр годится как фото одной рамы',
  },
  {
    slug: 'zhim-nogami-sidya-blochnyy',
    name: 'Жим ногами сидя (блочный)',
    zone: 'Ноги',
    weightStepKg: 2.5,
    photo: { file: 'photo_2026-10-16_21-46-57.jpg', crop: null },
    needsReview: true,
    reviewNote: 'Есть второй ракурс 21-46-58 — выбрать лучший кадр',
  },
  {
    slug: 'trenazhyor-dlya-goleni-stoya',
    name: 'Тренажёр для голени стоя',
    zone: 'Ноги',
    weightStepKg: 5,
    photo: { file: 'photo_2026-10-16_21-46-59.jpg', crop: null },
    needsReview: true,
    reviewNote:
      'В таблице помечено «уточнить»: голень стоя или мульти-хип. Кадр 21-47-00, возможно, тот же тренажёр',
  },
]

const BASE_EXERCISES: CatalogExercise[] = [
  {
    slug: 'zhim-nogami-v-platforme',
    name: 'Жим ногами в платформе',
    machine: 'zhim-nogami-45',
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings', 'adductors'],
    steps: [
      'Сядь, прижми спину и таз к спинке, стопы поставь на платформу на ширине плеч',
      'Сними платформу со стопоров и медленно опусти её к себе — колени до угла 90 градусов',
      'Выжми платформу вверх, не выпрямляй колени до конца',
      'Опускай под контролем, поясницу не отрывай',
    ],
    mistakes: [
      'Отрывать поясницу и таз от спинки',
      'Полностью выпрямлять колени в верхней точке',
      'Сводить колени внутрь при подъёме',
    ],
    tips: 'Стопы выше на платформе — больше работают ягодицы, ниже — квадрицепсы',
    defaultRepMin: 10,
    defaultRepMax: 15,
    overlayProfile: 'none',
  },
  {
    slug: 'gakk-prisedaniya',
    name: 'Гакк-приседания',
    machine: 'gakk-mashina',
    primary: ['quads'],
    secondary: ['glutes', 'hamstrings'],
    steps: [
      'Встань спиной к спинке, плечи заведи под упоры, стопы на ширине плеч',
      'Сними штангу со стопоров и выпрями корпус',
      'Медленно приседай: колени в сторону носков, спина прижата',
      'Опустись до угла 90 градусов в коленях и вернись вверх без рывка',
    ],
    mistakes: ['Сводить колени внутрь', 'Отрывать поясницу от спинки', 'Приседать слишком мелко'],
    tips: 'Пятки не отрывай: если глубины не хватает, поставь стопы чуть выше',
    defaultRepMin: 10,
    defaultRepMax: 12,
    overlayProfile: 'none',
  },
  {
    slug: 'svedenie-ruk-v-babochke',
    name: 'Сведение рук в «Бабочке»',
    machine: 'babochka',
    primary: ['chest'],
    secondary: ['delts-front'],
    steps: [
      'Сядь, прижми спину, предплечья положи на подушки — локти на уровне груди',
      'Своди руки перед собой усилием грудных',
      'В крайней точке задержись на секунду и напряги грудь',
      'Медленно верни руки назад, не бросай вес',
    ],
    mistakes: ['Поднимать плечи к ушам', 'Работать рывками и корпусом', 'Уводить локти ниже груди'],
    tips: 'Не гонись за весом: в «Бабочке» важнее амплитуда и напряжение в груди',
    defaultRepMin: 12,
    defaultRepMax: 15,
    overlayProfile: 'none',
  },
  {
    slug: 'obratnaya-babochka',
    name: 'Обратная бабочка',
    machine: 'babochka',
    primary: ['delts-rear'],
    secondary: ['traps-middle', 'rhomboids'],
    steps: [
      'Переставь рукояти в положение для обратных махов и сядь лицом к подушке',
      'Возьми рукояти, руки слегка согнуты, грудь расправлена',
      'Разводи руки в стороны, сводя лопатки',
      'Верни руки медленно, не расслабляй спину в конце',
    ],
    mistakes: [
      'Гнать вес по инерции корпусом',
      'Поднимать плечи вверх',
      'Брать слишком большой вес — вместо задних дельт работает трапеция',
    ],
    tips: 'Держи вес поменьше: задние дельты любят 12–15 чистых повторений',
    defaultRepMin: 12,
    defaultRepMax: 15,
    overlayProfile: 'none',
  },
  {
    slug: 'tyaga-verkhnego-bloka-obratnym-hvatom',
    name: 'Тяга верхнего блока обратным хватом',
    machine: 'tyaga-verkhnego-bloka',
    primary: ['lats', 'biceps'],
    secondary: ['traps-middle', 'delts-rear'],
    steps: [
      'Сядь, заведи колени под валики, возьми рукоять обратным хватом на ширине плеч',
      'Расправь грудь и слегка отклонись назад',
      'Тяни рукоять к низу груди, локти веди рядом с корпусом',
      'Плавно верни руки вверх до полного выпрямления',
    ],
    mistakes: ['Тянуть рывками корпусом', 'Сильно отклоняться назад', 'Бросать рукоять вверх'],
    tips: 'Обратный хват сильнее включает бицепс — вес ставь меньше, чем в тяге широким хватом',
    defaultRepMin: 10,
    defaultRepMax: 12,
    overlayProfile: 'none',
  },
  {
    slug: 'pulover-v-blochnom-trenazhere',
    name: 'Пуловер в блочном тренажёре',
    machine: 'tyaga-verkhnego-bloka',
    primary: ['lats'],
    secondary: ['teres', 'chest'],
    steps: [
      'Встань лицом к тренажёру, возьми рукоять сверху прямыми руками',
      'Сделай шаг назад и наклони корпус вперёд на 20–30 градусов',
      'Тяни рукоять к бёдрам прямыми руками — работают только плечевые суставы',
      'Медленно верни руки вверх, чувствуя растяжение широчайших',
    ],
    mistakes: ['Сгибать руки в локтях', 'Тянуть вес корпусом', 'Поднимать плечи к ушам'],
    tips: 'Хорош как добивающее упражнение для спины в конце тренировки',
    defaultRepMin: 12,
    defaultRepMax: 15,
    overlayProfile: 'none',
  },
  {
    slug: 'sgibanie-nog-lyozha',
    name: 'Сгибание ног лёжа',
    machine: 'sgibanie-nog-lyozha',
    primary: ['hamstrings'],
    secondary: ['glutes', 'calves'],
    steps: [
      'Ляг на скамью, валик поставь на ахиллы, руками возьмись за рукояти',
      'Прижми таз к скамье — он не должен подниматься',
      'Согни ноги, подводя валик к ягодицам',
      'Опусти ноги медленно, колени до конца не выпрямляй',
    ],
    mistakes: ['Отрывать таз от скамьи', 'Дёргать вес рывками', 'Работать в неполную амплитуду'],
    tips: 'Не гони вес: задняя поверхность бедра лучше отзывается на 12–15 повторений',
    defaultRepMin: 12,
    defaultRepMax: 15,
    overlayProfile: 'none',
  },
  {
    slug: 'svedenie-nog-sidya',
    name: 'Сведение ног сидя',
    machine: 'svedenie-razvedenie-nog',
    primary: ['adductors'],
    secondary: [],
    steps: [
      'Сядь, спину прижми к спинке, колени заведи за подушки',
      'Своди ноги вместе, напрягая внутреннюю поверхность бедра',
      'Задержись на секунду в крайней точке',
      'Медленно разведи ноги, не бросай вес',
    ],
    mistakes: ['Помогать корпусом и руками', 'Работать рывками', 'Брать слишком большой вес'],
    tips: 'Подушки ставь так, чтобы колени были на одной линии с тазобедренными суставами',
    defaultRepMin: 15,
    defaultRepMax: 20,
    overlayProfile: 'none',
    needsReview: true,
    reviewNote: 'Публиковать вместе с тренажёром: не подтверждено, что это комбо-машина',
  },
  {
    slug: 'razvedenie-nog-sidya',
    name: 'Разведение ног сидя',
    machine: 'svedenie-razvedenie-nog',
    primary: ['glutes-medius'],
    secondary: ['glutes'],
    steps: [
      'Сядь, прижми спину, колени поставь к подушкам изнутри',
      'Разводи ноги в стороны, корпус вперёд не наклоняй',
      'В крайней точке задержись на секунду',
      'Верни ноги медленно, сохраняя натяжение',
    ],
    mistakes: [
      'Наклоняться вперёд, чтобы помочь себе весом',
      'Разводить ноги рывком',
      'Отрывать таз от сиденья',
    ],
    tips: 'Средняя ягодичная держит колено стабильным — не пропускай, если бегаешь',
    defaultRepMin: 15,
    defaultRepMax: 20,
    overlayProfile: 'none',
    needsReview: true,
    reviewNote: 'Публиковать вместе с тренажёром: не подтверждено, что это комбо-машина',
  },
  {
    slug: 'sgibanie-nog-sidya',
    name: 'Сгибание ног сидя',
    machine: 'sgibanie-nog-sidya',
    primary: ['hamstrings'],
    secondary: ['calves'],
    steps: [
      'Сядь, заведи валик на заднюю поверхность голени выше ахилла',
      'Прижми бёдра фиксирующей подушкой',
      'Согни ноги, подтягивая валик к себе',
      'Разогни ноги плавно, не бросай вес',
    ],
    mistakes: ['Поднимать таз с сиденья', 'Работать рывками', 'Сгибать ноги не полностью'],
    tips: 'Сидя задняя поверхность бедра растягивается сильнее — вес бери меньше, чем лёжа',
    defaultRepMin: 12,
    defaultRepMax: 15,
    overlayProfile: 'none',
    needsReview: true,
    reviewNote: 'Кадр тренажёра обрезан — публиковать только после проверки фото',
  },
  {
    slug: 'tyaga-k-poyasu-s-uporom-v-grud',
    name: 'Тяга к поясу с упором в грудь',
    machine: 'rychazhnaya-tyaga-s-uporom-v-grud',
    primary: ['lats', 'traps-middle'],
    secondary: ['rhomboids', 'delts-rear', 'biceps'],
    steps: [
      'Упрись грудью в подушку и возьмись за рукояти',
      'Спину держи ровно, поясницу не кругли',
      'Тяни рукояти к поясу, сводя лопатки',
      'Верни руки медленно, растягивая широчайшие',
    ],
    mistakes: [
      'Отрываться грудью от подушки и помогать корпусом',
      'Тянуть вес за счёт бицепса',
      'Поднимать плечи вверх',
    ],
    tips: 'Упор в грудь снимает нагрузку с поясницы — удобно после становой',
    defaultRepMin: 10,
    defaultRepMax: 12,
    overlayProfile: 'none',
    needsReview: true,
    reviewNote: 'Публиковать вместе с тренажёром: опознание не подтверждено',
  },
  {
    slug: 'sgibanie-ruk-na-parte',
    name: 'Сгибание рук на парте',
    machine: 'parta-dlya-bicepsa',
    primary: ['biceps'],
    secondary: ['brachialis', 'forearms-flexors'],
    steps: [
      'Сядь, прижми грудь и плечи к подушке, возьмись за рукояти',
      'Локти держи неподвижно — работает только предплечье',
      'Согни руки полностью и напряги бицепс',
      'Опусти медленно, локти до щелчка не выпрямляй',
    ],
    mistakes: ['Отрывать локти от подушки', 'Помогать корпусом', 'Бросать вес вниз'],
    tips: 'Парта не даёт читинговать: вес здесь меньше, чем со штангой, и это нормально',
    defaultRepMin: 10,
    defaultRepMax: 12,
    overlayProfile: 'none',
    needsReview: true,
    reviewNote: 'Публиковать вместе с тренажёром: опознание не подтверждено',
  },
  {
    slug: 'zhim-ot-plech-sidya-v-blochnom-trenazhere',
    name: 'Жим от плеч сидя в блочном тренажёре',
    machine: 'blochnyy-zhim-ot-plech',
    primary: ['delts-front', 'delts-side'],
    secondary: ['triceps', 'traps-upper'],
    steps: [
      'Сядь, прижми спину к спинке, возьмись за рукояти на уровне плеч',
      'Выжми рукояти вверх, не сводя их полностью над головой',
      'Локти в верхней точке не блокируй',
      'Опусти рукояти до уровня плеч под контролем',
    ],
    mistakes: [
      'Прогибаться в пояснице и дожимать корпусом',
      'Блокировать локти',
      'Опускать рукояти слишком низко',
    ],
    tips: 'Держи пресс напряжённым — так поясница не заберёт нагрузку',
    defaultRepMin: 10,
    defaultRepMax: 12,
    overlayProfile: 'none',
    needsReview: true,
    reviewNote: 'Кадр тренажёра обрезан — публиковать только после проверки фото',
  },
  {
    slug: 'razgibanie-ruk-sidya-v-trenazhere',
    name: 'Разгибание рук сидя в тренажёре',
    machine: 'trenazhyor-dlya-tricepsa',
    primary: ['triceps'],
    secondary: [],
    steps: [
      'Сядь, возьмись за рукояти, локти прижми к бокам',
      'Разогни руки вниз до конца, напрягая трицепс',
      'Задержись на секунду в нижней точке',
      'Верни рукояти медленно — локти остаются на месте',
    ],
    mistakes: [
      'Разводить локти в стороны',
      'Наклоняться корпусом и давить весом тела',
      'Работать рывками',
    ],
    tips: 'Локти — неподвижная ось: как только они поехали, нагрузка ушла с трицепса',
    defaultRepMin: 10,
    defaultRepMax: 12,
    overlayProfile: 'none',
    needsReview: true,
    reviewNote: 'Публиковать вместе с тренажёром: опознание не подтверждено',
  },
  {
    slug: 'razgibanie-nog-v-rychazhnom-trenazhere',
    name: 'Разгибание ног в рычажном тренажёре',
    machine: 'rychazhnyy-trenazhyor-dlya-nog',
    primary: ['quads'],
    secondary: [],
    steps: [
      'Сядь, заведи стопы за валики, руками возьмись за рукояти',
      'Разогни ноги до конца, напрягая квадрицепсы',
      'Задержись на секунду в верхней точке',
      'Опусти ноги медленно — не бросай диски',
    ],
    mistakes: ['Поднимать таз с сиденья', 'Разгибать ноги рывком', 'Брать вес, при котором болят колени'],
    tips: 'Ставь первым в день ног, чтобы разогреть колени перед приседаниями',
    defaultRepMin: 12,
    defaultRepMax: 15,
    overlayProfile: 'none',
    needsReview: true,
    reviewNote:
      'Публиковать вместе с тренажёром: не подтверждено, разгибание это или сгибание. Если сгибание — поменять название и мышцы',
  },
  {
    slug: 'prisedaniya-v-rychazhnoy-mashine',
    name: 'Приседания в рычажной машине',
    machine: 'rychazhnaya-mashina-s-platformoy',
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings', 'lower-back'],
    steps: [
      'Встань на платформу, плечи заведи под упоры, стопы на ширине плеч',
      'Сними платформу со стопоров, корпус держи ровно',
      'Приседай, отводя таз назад, колени в сторону носков',
      'Вернись вверх, колени до конца не выпрямляй',
    ],
    mistakes: ['Сводить колени внутрь', 'Отрывать пятки от платформы', 'Скруглять спину'],
    tips: 'Машина задаёт траекторию — удобно, чтобы набить технику перед приседаниями со штангой',
    defaultRepMin: 10,
    defaultRepMax: 12,
    overlayProfile: 'none',
    needsReview: true,
    reviewNote:
      'Публиковать вместе с тренажёром: не подтверждено, присед это или тяга. Если тяга — заменить упражнение',
  },
  {
    slug: 'skruchivaniya-na-naklonnoy-skamye',
    name: 'Скручивания на наклонной скамье',
    machine: 'skamya-dlya-pressa',
    primary: ['abs'],
    secondary: ['obliques', 'hip-flexors'],
    steps: [
      'Ляг на скамью, ноги зафиксируй в валиках, руки держи у груди',
      'Скручивай корпус, отрывая от скамьи только лопатки',
      'В верхней точке задержись на секунду',
      'Опускайся медленно, не падай на скамью',
    ],
    mistakes: [
      'Подниматься до сидячего положения — работают сгибатели бедра, а не пресс',
      'Тянуть себя руками за голову',
      'Делать движение рывком',
    ],
    tips: 'Чем выше наклон, тем тяжелее. Поднимай угол, когда 20 повторений станут лёгкими',
    defaultRepMin: 15,
    defaultRepMax: 20,
    overlayProfile: 'none',
    needsReview: true,
    reviewNote: 'Публиковать вместе с тренажёром: на кадре ряд скамей, нужная не подтверждена',
  },
  {
    slug: 'podyom-nog-na-naklonnoy-skamye',
    name: 'Подъём ног на наклонной скамье',
    machine: 'skamya-dlya-pressa',
    primary: ['abs', 'hip-flexors'],
    secondary: ['obliques'],
    steps: [
      'Ляг на скамью, руками возьмись за опору над головой',
      'Ноги слегка согни в коленях',
      'Подними ноги вверх, подкручивая таз',
      'Опусти ноги медленно, не бросай их вниз',
    ],
    mistakes: [
      'Раскачиваться корпусом',
      'Поднимать только ноги, оставляя таз на скамье',
      'Бросать ноги вниз по инерции',
    ],
    tips: 'Тяжело — делай меньше амплитуда, но пресс держи напряжённым всю дорогу',
    defaultRepMin: 12,
    defaultRepMax: 15,
    overlayProfile: 'none',
    needsReview: true,
    reviewNote: 'Публиковать вместе с тренажёром: на кадре ряд скамей, нужная не подтверждена',
  },
  {
    slug: 'podyom-nog-v-upore-na-loktyah',
    name: 'Подъём ног в упоре на локтях',
    machine: 'brusnya-s-uporom-na-loktyakh',
    primary: ['abs', 'hip-flexors'],
    secondary: ['obliques'],
    steps: [
      'Встань в упор на локти, спину прижми к подушке',
      'Ноги слегка согни, корпус держи неподвижно',
      'Подними колени к груди, подкручивая таз',
      'Опусти ноги под контролем, не раскачивайся',
    ],
    mistakes: [
      'Раскачиваться и работать по инерции',
      'Поднимать только колени, не подкручивая таз',
      'Проваливаться в плечах',
    ],
    tips: 'Начни с коленей к груди; прямые ноги добавляй, когда 15 повторений даются легко',
    defaultRepMin: 12,
    defaultRepMax: 15,
    overlayProfile: 'none',
    needsReview: true,
    reviewNote: 'Публиковать вместе с тренажёром: кадр сборный, нужный тренажёр не подтверждён',
  },
  {
    slug: 'otzhimaniya-na-brusyakh',
    name: 'Отжимания на брусьях',
    machine: 'brusnya-s-uporom-na-loktyakh',
    primary: ['chest', 'triceps'],
    secondary: ['delts-front'],
    steps: [
      'Запрыгни на брусья, выпрями руки, корпус слегка наклони вперёд',
      'Опускайся, разводя локти в стороны, до угла 90 градусов',
      'Выжми себя вверх, локти до конца не блокируй',
      'Пресс держи напряжённым, ноги не болтаются',
    ],
    mistakes: [
      'Опускаться слишком глубоко — нагрузка уходит в плечевой сустав',
      'Держать корпус вертикально, если цель — грудь',
      'Дёргаться и помогать ногами',
    ],
    tips: 'Наклон корпуса вперёд — больше грудь, вертикально — больше трицепс',
    defaultRepMin: 8,
    defaultRepMax: 12,
    overlayProfile: 'none',
    needsReview: true,
    reviewNote: 'Публиковать вместе с тренажёром: кадр сборный, брусья не подтверждены',
  },
  {
    slug: 'prisedaniya-so-shtangoy',
    name: 'Приседания со штангой',
    machine: 'silovaya-rama',
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings', 'lower-back', 'abs'],
    steps: [
      'Поставь штангу на стойки по росту и зайди под гриф на трапеции',
      'Сними штангу, сделай два шага назад, стопы на ширине плеч',
      'Приседай, отводя таз назад, колени в сторону носков',
      'Опустись до параллели бедра с полом и вернись вверх',
      'После подхода верни штангу на стойки',
    ],
    mistakes: ['Сводить колени внутрь', 'Отрывать пятки от пола', 'Скруглять поясницу'],
    tips: 'Начинай с пустого грифа: в приседаниях техника важнее веса',
    defaultRepMin: 8,
    defaultRepMax: 10,
    overlayProfile: 'none',
    needsReview: true,
    reviewNote: 'Публиковать вместе с тренажёром: на кадре общий план стоек',
  },
  {
    slug: 'zhim-shtangi-stoya',
    name: 'Жим штанги стоя',
    machine: 'silovaya-rama',
    primary: ['delts-front', 'delts-side'],
    secondary: ['triceps', 'traps-upper', 'abs'],
    steps: [
      'Поставь штангу на стойки на уровне груди, возьмись хватом чуть шире плеч',
      'Сними штангу, локти прижми к корпусу, напряги пресс и ягодицы',
      'Выжми штангу вверх — в верхней точке гриф над головой',
      'Опусти штангу к груди под контролем',
    ],
    mistakes: ['Прогибаться в пояснице', 'Подседать ногами вместо жима', 'Вести гриф по дуге вперёд'],
    tips: 'Ягодицы и пресс держи напряжёнными — они удерживают поясницу',
    defaultRepMin: 8,
    defaultRepMax: 10,
    overlayProfile: 'none',
    needsReview: true,
    reviewNote: 'Публиковать вместе с тренажёром: на кадре общий план стоек',
  },
  {
    slug: 'stanovaya-tyaga',
    name: 'Становая тяга',
    machine: 'silovaya-rama',
    primary: ['lower-back', 'glutes', 'hamstrings'],
    secondary: ['lats', 'traps-middle', 'quads'],
    steps: [
      'Встань так, чтобы гриф был над серединой стопы',
      'Наклонись, возьмись за гриф хватом на ширине плеч, спина прямая',
      'Толкнись ногами в пол и веди штангу вплотную к ногам',
      'Выпрямись, в верхней точке назад не отклоняйся',
      'Опусти штангу по той же траектории, колени сгибай в конце',
    ],
    mistakes: ['Круглая спина', 'Держать гриф далеко от ног', 'Отклоняться назад в верхней точке'],
    tips: 'Самое тяжёлое движение в зале: ставь его первым, пока спина свежая',
    defaultRepMin: 6,
    defaultRepMax: 8,
    overlayProfile: 'none',
    needsReview: true,
    reviewNote: 'Публиковать вместе с тренажёром: на кадре общий план стоек и помоста',
  },
  {
    slug: 'zhim-nogami-sidya-v-blochnom-trenazhere',
    name: 'Жим ногами сидя в блочном тренажёре',
    machine: 'zhim-nogami-sidya-blochnyy',
    primary: ['quads'],
    secondary: ['glutes', 'hamstrings'],
    steps: [
      'Сядь, прижми спину к спинке, стопы поставь на платформу на ширине плеч',
      'Выжми платформу вперёд, колени до конца не выпрямляй',
      'Медленно верни платформу к себе — колени до угла 90 градусов',
      'Поясницу держи прижатой к спинке всю дорогу',
    ],
    mistakes: [
      'Отрывать таз и поясницу от спинки',
      'Блокировать колени в крайней точке',
      'Ставить стопы слишком низко',
    ],
    tips: 'Блочный жим мягче для спины, чем жим под 45 градусов, — удобен, если поясница побаливает',
    defaultRepMin: 12,
    defaultRepMax: 15,
    overlayProfile: 'none',
    needsReview: true,
    reviewNote: 'Есть второй ракурс 21-46-58 — выбрать лучший кадр и снять флаг',
  },
  {
    slug: 'podyom-na-noski-stoya',
    name: 'Подъём на носки стоя',
    machine: 'trenazhyor-dlya-goleni-stoya',
    primary: ['calves'],
    secondary: [],
    steps: [
      'Встань носками на платформу, пятки свисают, упоры поставь на плечи',
      'Опусти пятки вниз, растягивая икры',
      'Поднимись на носки максимально высоко',
      'Задержись на секунду и опусти медленно',
    ],
    mistakes: ['Пружинить и делать движение коротким', 'Сгибать колени', 'Бросать пятки вниз'],
    tips: 'Икры любят полную амплитуду и паузу внизу — вес при этом меньше, чем кажется',
    defaultRepMin: 15,
    defaultRepMax: 20,
    overlayProfile: 'none',
    needsReview: true,
    reviewNote:
      'Публиковать вместе с тренажёром: не подтверждено, голень это или мульти-хип. Если мульти-хип — заменить упражнение на отведение бедра',
  },
]

/** Фото-каталог зала плюс свободные веса и растяжка (`extra.ts`). */
export const KOLIZEY_MACHINES: CatalogMachine[] = [...BASE_MACHINES, ...EXTRA_MACHINES]
export const KOLIZEY_EXERCISES: CatalogExercise[] = [...BASE_EXERCISES, ...EXTRA_EXERCISES]

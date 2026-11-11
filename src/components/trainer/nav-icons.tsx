import {
  ChartColumn,
  CreditCard,
  Dumbbell,
  Ellipsis,
  PersonStanding,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { TrainerNavIcon } from '@/components/trainer/nav-items'

/** Одна карта иконок на боковое меню и нижнюю навигацию. */
export const NAV_ICONS: Record<TrainerNavIcon, LucideIcon> = {
  today: ChartColumn,
  clients: Users,
  programs: Dumbbell,
  exercises: PersonStanding,
  machines: Wrench,
  subscriptions: CreditCard,
  more: Ellipsis,
}

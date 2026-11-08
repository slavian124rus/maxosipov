import { requireUser } from '@/modules/auth'
import { listMachines } from '@/modules/catalog'
import { MachineForm } from '@/components/trainer/machine-form'

// Кабинет зависит от сессии и прав.
export const instant = false

export default async function TrainerMachinesPage() {
  await requireUser()
  const machines = await listMachines()

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-[22px] font-semibold">Тренажёры</h1>

      <ul className="flex flex-col gap-2">
        {machines.map((machine) => (
          <li
            key={machine.id}
            className="flex items-baseline justify-between gap-2 rounded-card border border-border bg-surface-1 px-4 py-3"
          >
            <span className="text-[17px]">{machine.name}</span>
            <span className="text-[13px] text-text-muted">
              {machine.zone ?? 'без зоны'} · шаг {machine.weightStepKg} кг
            </span>
          </li>
        ))}
      </ul>

      {machines.length === 0 ? (
        <p className="text-[15px] text-text-secondary">Пока ни одного тренажёра</p>
      ) : null}

      <MachineForm />
    </main>
  )
}

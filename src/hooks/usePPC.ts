import { useMemo } from 'react'
import { calculerPPC, calculerAvancement, getPpcColor } from '@/utils/ppc'
import type { Task } from '@/types/models'

export function usePPC(tasks: Task[]) {
  return useMemo(() => {
    const ppc = calculerPPC(tasks)
    const avancement = calculerAvancement(tasks)
    const color = getPpcColor(ppc)
    const engagees = tasks.filter(t => t.engage)
    const completees = engagees.filter(t => t.status === 'done')
    return { ppc, avancement, color, engagees: engagees.length, completees: completees.length }
  }, [tasks])
}

import type { TaskStatus } from '@/types/models'
import { STATUS_LABELS } from '@/utils/statusMachine'

interface Props {
  status: TaskStatus
  size?: 'sm' | 'md'
}

export default function StatusBadge({ status, size = 'sm' }: Props) {
  const sizeClass = size === 'md' ? 'text-sm px-3 py-1' : 'text-xs px-2 py-0.5'
  return (
    <span className={`badge-${status} ${sizeClass} rounded-full font-medium inline-block`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export function StatusDot({ status }: { status: TaskStatus }) {
  const colors: Record<TaskStatus, string> = {
    todo:        'bg-gray-400',
    en_cours:    'bg-blue-500',
    a_controler: 'bg-amber-500',
    done:        'bg-green-500',
    blocked:     'bg-red-500'
  }
  return <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors[status]}`} />
}

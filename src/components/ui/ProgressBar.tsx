interface Props {
  value: number // 0-100
  color?: string
  height?: string
  showLabel?: boolean
  className?: string
}

export default function ProgressBar({ value, color = '#3B82F6', height = 'h-2', showLabel = false, className = '' }: Props) {
  const pct = Math.min(100, Math.max(0, value))

  const getColor = () => {
    if (pct >= 80) return '#22C55E'
    if (pct >= 50) return '#F59E0B'
    return '#EF4444'
  }

  const bgColor = color === 'auto' ? getColor() : color

  return (
    <div className={`${className}`}>
      <div className={`${height} bg-gray-100 rounded-full overflow-hidden`}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: bgColor }}
        />
      </div>
      {showLabel && (
        <p className="text-right text-xs text-gray-500 mt-0.5">{pct}%</p>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'

interface AnimatedNumberProps {
  value: number
  duration?: number
  formatter?: (val: number) => string
  className?: string
}

export default function AnimatedNumber({
  value,
  duration = 450,
  formatter,
  className = '',
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    // Respect reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion || duration <= 0) {
      setDisplayValue(value)
      return
    }

    let startTime: number | null = null
    const startVal = displayValue
    const endVal = value
    const change = endVal - startVal

    let animationFrameId: number

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      // Ease out quad
      const easedProgress = 1 - (1 - progress) * (1 - progress)
      const current = Math.round(startVal + change * easedProgress)
      setDisplayValue(current)

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step)
      }
    }

    animationFrameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animationFrameId)
  }, [value, duration])

  const formatted = formatter ? formatter(displayValue) : displayValue.toLocaleString()

  return <span className={`tabular-numbers ${className}`}>{formatted}</span>
}

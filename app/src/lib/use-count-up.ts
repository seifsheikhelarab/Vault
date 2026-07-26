import { useEffect, useState, useRef } from 'react'

const DURATION = 600
const EASE_OUT = 0.22

export function useCountUp(target: number, enabled = true) {
  const [display, setDisplay] = useState(0)
  const startTime = useRef<number | null>(null)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) {
      setDisplay(target)
      return
    }

    startTime.current = null

    const animate = (now: number) => {
      if (startTime.current === null) startTime.current = now
      const elapsed = now - startTime.current
      const progress = Math.min(elapsed / DURATION, 1)
      // Cubic bezier ease-out approximation: t => 1 - (1-t)^3
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(target * eased)

      if (progress < 1) {
        raf.current = requestAnimationFrame(animate)
      } else {
        setDisplay(target)
      }
    }

    raf.current = requestAnimationFrame(animate)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [target, enabled])

  return display
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export const MOTION_BASE_MS = 200
/** Buffer after mount so the browser paints the hidden state before activating. */
export const MOTION_ACTIVATE_MS = 24

/**
 * Keep overlay/panel mounted briefly so CSS exit transitions can run.
 * Uses a generation counter so rapid open/close cannot leave stale timers
 * or skip the enter animation.
 */
export function useMotionMount(open) {
  const [render, setRender] = useState(false)
  const [active, setActive] = useState(false)
  const genRef = useRef(0)

  useLayoutEffect(() => {
    if (!open) return
    genRef.current += 1
    setRender(true)
    setActive(false)
  }, [open])

  useEffect(() => {
    if (open) {
      const gen = genRef.current
      const activateTimer = window.setTimeout(() => {
        if (genRef.current === gen) setActive(true)
      }, MOTION_ACTIVATE_MS)
      return () => clearTimeout(activateTimer)
    }

    genRef.current += 1
    setActive(false)
    const gen = genRef.current
    const unmountTimer = window.setTimeout(() => {
      if (genRef.current === gen) setRender(false)
    }, MOTION_BASE_MS)
    return () => clearTimeout(unmountTimer)
  }, [open])

  return { render, active }
}

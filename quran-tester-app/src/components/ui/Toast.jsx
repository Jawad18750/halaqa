import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MOTION_ACTIVATE_MS } from '../../lib/useMotionMount.js'

const VISIBLE_MS = 2000
const EXIT_MS = 180

export default function Toast({ message, onDone }) {
  const [render, setRender] = useState(false)
  const [visible, setVisible] = useState(false)
  const genRef = useRef(0)

  useLayoutEffect(() => {
    if (!message) return
    genRef.current += 1
    setRender(true)
    setVisible(false)
  }, [message])

  useEffect(() => {
    if (!message) return undefined

    const gen = genRef.current
    const activateTimer = window.setTimeout(() => {
      if (genRef.current === gen) setVisible(true)
    }, MOTION_ACTIVATE_MS)

    const hideTimer = window.setTimeout(() => {
      if (genRef.current === gen) setVisible(false)
    }, VISIBLE_MS)

    const unmountTimer = window.setTimeout(() => {
      if (genRef.current !== gen) return
      setRender(false)
      onDone?.()
    }, VISIBLE_MS + EXIT_MS)

    return () => {
      clearTimeout(activateTimer)
      clearTimeout(hideTimer)
      clearTimeout(unmountTimer)
    }
  }, [message, onDone])

  if (!render || !message) return null

  return (
    <div
      className={`toast motion-toast ${visible ? 'motion-toast--visible' : ''}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  )
}

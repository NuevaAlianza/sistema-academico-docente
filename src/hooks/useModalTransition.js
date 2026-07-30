import { useState, useEffect, useRef } from 'react'

const EXIT_MS = 160

// Keeps a modal mounted for EXIT_MS after `value` goes falsy, so the closing
// CSS transition (data-closing) can play instead of the element disappearing
// instantly. Returns { value, closing } (using the last truthy value while
// closing) or null once fully closed. Does not change when/why a modal opens
// or closes — only how long its DOM node survives the close.
export function useModalTransition(value) {
  const [renderValue, setRenderValue] = useState(value)
  const [closing, setClosing] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    if (value) {
      clearTimeout(timer.current)
      setRenderValue(value)
      setClosing(false)
    } else if (renderValue) {
      setClosing(true)
      timer.current = setTimeout(() => { setRenderValue(null); setClosing(false) }, EXIT_MS)
    }
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return renderValue ? { value: renderValue, closing } : null
}

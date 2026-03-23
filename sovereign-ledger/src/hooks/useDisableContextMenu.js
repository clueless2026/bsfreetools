import { useEffect } from 'react'

/**
 * Discourages casual context-menu / Inspect access on sensitive pages (not a security boundary).
 */
export function useDisableContextMenu(enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return undefined
    }
    const onContextMenu = (event) => {
      event.preventDefault()
    }
    document.addEventListener('contextmenu', onContextMenu)
    return () => document.removeEventListener('contextmenu', onContextMenu)
  }, [enabled])
}

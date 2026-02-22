import { onMount, onCleanup } from 'solid-js'

interface ShortcutOptions {
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
}

/**
 * A reusable Solid.js hook to handle keyboard shortcuts.
 *
 * @param key The key to listen for (e.g., 'b', 'Enter', 'Escape')
 * @param onShortcut Callback function to execute when the shortcut is pressed
 * @param options Modifier keys required for the shortcut
 */
export function useKeyboardShortcut(
  key: string,
  onShortcut: () => void,
  options: ShortcutOptions = {},
) {
  const {
    ctrlKey = false,
    shiftKey = false,
    altKey = false,
    metaKey = false,
  } = options

  const handleKeyDown = (e: KeyboardEvent) => {
    const keyMatch = e.key.toLowerCase() === key.toLowerCase()
    const ctrlMatch = ctrlKey === e.ctrlKey
    const shiftMatch = shiftKey === e.shiftKey
    const altMatch = altKey === e.altKey
    const metaMatch = metaKey === e.metaKey

    if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
      e.preventDefault()
      onShortcut()
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })
}

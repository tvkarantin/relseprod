import { useEffect } from 'react'

/**
 * Warn before leaving the page while changes are still unsaved.
 *
 * The prompt only appears when `hasUnsavedChanges` is true, so a fully saved
 * editor never blocks navigation.
 */
export function useUnsavedChanges(hasUnsavedChanges: boolean): void {
  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Required by older browsers to trigger the native dialog.
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])
}

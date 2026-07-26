import { useCallback, useEffect, useRef, useState } from 'react'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

export const AUTOSAVE_DELAY_MS = 800

interface UseAutosaveOptions<T> {
  /** Current form values (already validated by the caller). */
  values: T | null
  /** Values as last confirmed by the server; used to detect real changes. */
  baseline: T | null
  /** Whether the current values pass validation. */
  isValid: boolean
  /** Performs the actual request. */
  save: (values: T) => Promise<void>
  /** Disable autosave entirely (e.g. while the reel is still loading). */
  enabled?: boolean
  delayMs?: number
}

export interface AutosaveResult {
  state: SaveState
  /** True while there is unsaved input, including a failed save. */
  hasUnsavedChanges: boolean
  errorMessage: string | null
  /** Force an immediate save; used by the manual "Сохранить" button. */
  saveNow: () => void
}

function isEqual<T>(a: T | null, b: T | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Debounced autosave with stale-response protection.
 *
 * Guarantees:
 * - the initial load never triggers a request;
 * - fast typing produces one request, not one per keystroke;
 * - a newer edit cancels the pending debounce;
 * - a slow response can never overwrite newer input (requests are versioned);
 * - a failed save keeps the user's text and allows a manual retry.
 */
export function useAutosave<T>({
  values,
  baseline,
  isValid,
  save,
  enabled = true,
  delayMs = AUTOSAVE_DELAY_MS,
}: UseAutosaveOptions<T>): AutosaveResult {
  const [state, setState] = useState<SaveState>('saved')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Last payload the server confirmed. Compared against current values.
  const savedRef = useRef<T | null>(baseline)
  // Monotonic request id: only the newest response may update the state.
  const requestIdRef = useRef(0)
  const inFlightRef = useRef<string | null>(null)
  const valuesRef = useRef<T | null>(values)
  const saveRef = useRef(save)

  valuesRef.current = values
  saveRef.current = save

  // Adopt a new baseline when the editor switches to another reel.
  useEffect(() => {
    savedRef.current = baseline
    requestIdRef.current += 1
    inFlightRef.current = null
    setState('saved')
    setErrorMessage(null)
  }, [baseline])

  const runSave = useCallback(async (payload: T) => {
    const serialized = JSON.stringify(payload)
    // Skip an identical request that is already on the wire.
    if (inFlightRef.current === serialized) return

    const requestId = ++requestIdRef.current
    inFlightRef.current = serialized
    setState('saving')
    setErrorMessage(null)

    try {
      await saveRef.current(payload)
      if (requestId !== requestIdRef.current) return // a newer save superseded this one
      savedRef.current = payload
      inFlightRef.current = null
      // Values may have changed while the request was in flight.
      setState(isEqual(valuesRef.current, payload) ? 'saved' : 'dirty')
    } catch (error) {
      if (requestId !== requestIdRef.current) return
      inFlightRef.current = null
      setState('error')
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось сохранить')
    }
  }, [])

  // Debounced autosave.
  useEffect(() => {
    if (!enabled || values === null) return
    if (isEqual(values, savedRef.current)) return

    if (!isValid) {
      setState('dirty')
      return
    }

    setState((current) => (current === 'saving' ? current : 'dirty'))

    const timeoutId = setTimeout(() => {
      void runSave(values)
    }, delayMs)

    return () => clearTimeout(timeoutId)
  }, [values, isValid, enabled, delayMs, runSave])

  const saveNow = useCallback(() => {
    const current = valuesRef.current
    if (current === null || !isValid) return
    void runSave(current)
  }, [isValid, runSave])

  const hasUnsavedChanges =
    enabled && values !== null && !isEqual(values, savedRef.current)

  return { state, hasUnsavedChanges, errorMessage, saveNow }
}

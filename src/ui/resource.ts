import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js"

export type AsyncState<T> = {
  data?: T
  loading: boolean
  error?: string
}

export function createAbortableResource<T>(
  source: Accessor<unknown>,
  loader: (signal: AbortSignal) => Promise<T>,
): Accessor<AsyncState<T>> {
  const [state, setState] = createSignal<AsyncState<T>>({ loading: true })

  createEffect(() => {
    source()
    const controller = new AbortController()
    let current = true
    setState((previous) => ({ ...previous, loading: true, error: undefined }))
    void loader(controller.signal).then(
      (data) => {
        if (current) setState({ data, loading: false })
      },
      (error) => {
        if (!current || controller.signal.aborted) return
        setState((previous) => ({
          ...previous,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        }))
      },
    )
    onCleanup(() => {
      current = false
      controller.abort()
    })
  })

  return state
}

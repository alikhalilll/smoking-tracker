import { ref, type Ref } from 'vue'

/**
 * Tiny singleton service for vaul-driven confirmation dialogs.
 * Replaces the browser's native confirm() so every dialog in the app
 * looks like the rest of our drawer-based UI.
 *
 * Usage:
 *   const { confirm } = useConfirm()
 *   const ok = await confirm({ title: 'Delete?', body: 'Cannot undo.', variant: 'danger' })
 *   if (!ok) return
 */

export interface ConfirmOptions {
  title: string
  body?: string
  /** Label for the affirmative button. Defaults to a generic "OK". */
  confirmText?: string
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelText?: string
  /** 'danger' colors the confirm button red — use for destructive actions. */
  variant?: 'danger' | 'default'
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void
}

// Module-level singletons so any component can share the same drawer.
const open: Ref<boolean> = ref(false)
const state: Ref<ConfirmState | null> = ref(null)

export interface UseConfirm {
  open: Ref<boolean>
  state: Ref<ConfirmState | null>
  /** Show a confirmation drawer; resolves true (confirm) or false (cancel). */
  confirm: (opts: ConfirmOptions) => Promise<boolean>
  /** Internal: called by the drawer when the user picks an answer. */
  answer: (value: boolean) => void
  /** Internal: vaul's open-state hook. Outside-tap / drag-down counts as Cancel. */
  setOpen: (value: boolean) => void
}

export function useConfirm(): UseConfirm {
  function confirm(opts: ConfirmOptions): Promise<boolean> {
    // If a previous prompt is somehow still up, close it as cancelled
    // before showing the next — guarantees no orphaned promises.
    if (state.value) state.value.resolve(false)
    return new Promise<boolean>((resolve) => {
      state.value = { ...opts, resolve }
      open.value = true
    })
  }

  function answer(value: boolean): void {
    state.value?.resolve(value)
    state.value = null
    open.value = false
  }

  function setOpen(value: boolean): void {
    if (!value && state.value) {
      // User dismissed via drag/Esc/outside-tap — treat as cancel.
      state.value.resolve(false)
      state.value = null
    }
    open.value = value
  }

  return { open, state, confirm, answer, setOpen }
}

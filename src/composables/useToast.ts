import { ref, type Ref } from 'vue'

export type ToastTone = 'default' | 'success' | 'warn' | 'danger'

export interface ToastMessage {
  id: number
  text: string
  tone: ToastTone
}

const messages: Ref<ToastMessage[]> = ref([])
let nextId = 1

export function useToast() {
  function show(text: string, tone: ToastTone = 'default'): void {
    const id = nextId++
    messages.value.push({ id, text, tone })
    setTimeout(() => {
      const idx = messages.value.findIndex((m) => m.id === id)
      if (idx >= 0) messages.value.splice(idx, 1)
    }, 3500)
  }
  return { messages, show }
}

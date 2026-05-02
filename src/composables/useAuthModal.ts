import { ref, type Ref } from 'vue'

const isOpen: Ref<boolean> = ref(false)

export function useAuthModal() {
  function open(): void {
    isOpen.value = true
  }
  function close(): void {
    isOpen.value = false
  }
  return { isOpen, open, close }
}

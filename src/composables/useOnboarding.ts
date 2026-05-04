import { computed, ref, type ComputedRef, type Ref } from 'vue'

export type OnboardingTabId =
  | 'home'
  | 'history'
  | 'quit'
  | 'leaderboard'
  | 'settings'

export type SettingsSection = 'account' | 'app' | 'reminders' | 'data'

export interface OnboardingStep {
  id: string
  view: OnboardingTabId
  settingsSection?: SettingsSection
  /** CSS selector for the element to spotlight. Null = centered card, no spotlight. */
  selector?: string | null
  titleKey: string
  bodyKey: string
  /** When false, the step is dropped before the tour starts. */
  condition?: () => boolean
}

const STORAGE_KEY = 'st-onboarding-v1'

const active = ref(false)
const stepIndex = ref(0)
const steps = ref<OnboardingStep[]>([])
const completed = ref(loadCompleted())
const confettiTick = ref(0)
const desiredSettingsSection = ref<SettingsSection | null>(null)

function loadCompleted(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === '1'
}

function persistCompleted(v: boolean): void {
  if (typeof localStorage === 'undefined') return
  if (v) localStorage.setItem(STORAGE_KEY, '1')
  else localStorage.removeItem(STORAGE_KEY)
}

function setHashView(view: OnboardingTabId): void {
  if (typeof window === 'undefined') return
  const next = `#/${view}`
  if (window.location.hash !== next) {
    window.history.replaceState(null, '', next)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }
}

export interface UseOnboarding {
  active: Ref<boolean>
  stepIndex: Ref<number>
  steps: Ref<OnboardingStep[]>
  step: ComputedRef<OnboardingStep | null>
  isFirst: ComputedRef<boolean>
  isLast: ComputedRef<boolean>
  completed: Ref<boolean>
  confettiTick: Ref<number>
  desiredSettingsSection: Ref<SettingsSection | null>
  start: (newSteps: OnboardingStep[]) => void
  next: () => void
  prev: () => void
  exit: () => void
  finish: () => void
}

export function useOnboarding(): UseOnboarding {
  const step = computed<OnboardingStep | null>(
    () => steps.value[stepIndex.value] ?? null
  )
  const isFirst = computed(() => stepIndex.value === 0)
  const isLast = computed(
    () => stepIndex.value >= steps.value.length - 1
  )

  // Walk in `direction` past any steps whose runtime condition is
  // currently false. Conditions are evaluated each navigation tick
  // rather than once at start, so state changes mid-tour (e.g. the
  // user signs in) correctly show or hide later steps.
  function skipFiltered(direction: 1 | -1): void {
    while (
      stepIndex.value >= 0 &&
      stepIndex.value < steps.value.length &&
      steps.value[stepIndex.value].condition &&
      !steps.value[stepIndex.value].condition!()
    ) {
      stepIndex.value += direction
    }
  }

  function applyStep(direction: 1 | -1 = 1): void {
    skipFiltered(direction)
    if (stepIndex.value >= steps.value.length) {
      finish()
      return
    }
    if (stepIndex.value < 0) {
      // Stepping back ran past the first visible step — clamp and let
      // the (visible) first step show.
      stepIndex.value = 0
      skipFiltered(1)
      if (stepIndex.value >= steps.value.length) {
        finish()
        return
      }
    }
    const s = step.value
    if (!s) return
    setHashView(s.view)
    desiredSettingsSection.value = s.settingsSection ?? null
    confettiTick.value++
  }

  function start(newSteps: OnboardingStep[]): void {
    if (newSteps.length === 0) return
    steps.value = newSteps
    stepIndex.value = 0
    active.value = true
    applyStep(1)
  }

  function next(): void {
    if (stepIndex.value >= steps.value.length - 1) {
      finish()
      return
    }
    stepIndex.value++
    applyStep(1)
  }

  function prev(): void {
    if (stepIndex.value <= 0) return
    stepIndex.value--
    applyStep(-1)
  }

  function exit(): void {
    active.value = false
    desiredSettingsSection.value = null
  }

  function finish(): void {
    completed.value = true
    persistCompleted(true)
    exit()
  }

  return {
    active,
    stepIndex,
    steps,
    step,
    isFirst,
    isLast,
    completed,
    confettiTick,
    desiredSettingsSection,
    start,
    next,
    prev,
    exit,
    finish,
  }
}

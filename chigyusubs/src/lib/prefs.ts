export type UserPrefs = {
  modelName?: string
  models?: string[]
  mediaResolution?: 'low' | 'standard'
  useAudioOnly?: boolean
  sourceLang?: string
  targetLang?: string
  style?: string
  chunkSeconds?: number
  chunkOverlap?: number
  concurrency?: number
  temperature?: number
  customPrompt?: string
  glossary?: string
  summaryText?: string
  summaryPrompt?: string
  glossaryPrompt?: string
  useSummary?: boolean
  useGlossary?: boolean
  safetyOff?: boolean
}

const PREFS_KEY = 'chigyusubs_prefs'

export function loadPrefs(): UserPrefs | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as UserPrefs
  } catch {
    return null
  }
}

export function savePrefs(prefs: UserPrefs): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // ignore storage errors
  }
}

export function clearPrefs(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(PREFS_KEY)
  } catch {
    // ignore storage errors
  }
}

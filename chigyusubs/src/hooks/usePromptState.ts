import { useState } from 'react'
import {
  DEFAULT_GLOSSARY_PROMPT,
  DEFAULT_SUMMARY_PROMPT,
  DEFAULT_USE_GLOSSARY,
  DEFAULT_USE_SUMMARY,
} from '../config/defaults'

export function usePromptState() {
  const [summaryText, setSummaryText] = useState('')
  const [summaryStatus, setSummaryStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [summaryError, setSummaryError] = useState('')
  const [glossaryStatus, setGlossaryStatus] = useState<'idle' | 'loading'>('idle')
  const [glossaryError, setGlossaryError] = useState('')
  const [summaryPrompt, setSummaryPrompt] = useState(DEFAULT_SUMMARY_PROMPT)
  const [useSummary, setUseSummary] = useState(DEFAULT_USE_SUMMARY)
  const [glossaryPrompt, setGlossaryPrompt] = useState(DEFAULT_GLOSSARY_PROMPT)
  const [glossary, setGlossary] = useState('')
  const [useGlossary, setUseGlossary] = useState(DEFAULT_USE_GLOSSARY)

  return {
    state: {
      summaryText,
      summaryStatus,
      summaryError,
      glossaryStatus,
      glossaryError,
      summaryPrompt,
      useSummary,
      glossaryPrompt,
      glossary,
      useGlossary,
    },
    actions: {
      setSummaryText,
      setSummaryStatus,
      setSummaryError,
      setGlossaryStatus,
      setGlossaryError,
      setSummaryPrompt,
      setUseSummary,
      setGlossaryPrompt,
      setGlossary,
      setUseGlossary,
    },
  }
}

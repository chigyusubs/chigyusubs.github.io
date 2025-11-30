import React from 'react'
import { useTheme } from '../../lib/themeContext'

type Tone = 'primary' | 'secondary' | 'upload' | 'danger'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone
}

export function Button({ tone = 'primary', className = '', children, ...rest }: Props) {
  const theme = useTheme()
  const toneClass =
    tone === 'secondary'
      ? theme.buttonSecondary
      : tone === 'upload'
        ? theme.buttonUpload
        : tone === 'danger'
          ? theme.buttonDanger
          : theme.buttonPrimary

  const merged = `${toneClass} ${className}`.trim()

  return (
    <button className={merged} {...rest}>
      {children}
    </button>
  )
}

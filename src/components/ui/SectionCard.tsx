import React from 'react'
import { useTheme } from '../../lib/themeContext'

type Props = {
  title?: string
  children: React.ReactNode
  className?: string
  subtitle?: string
}

export function SectionCard({ title, subtitle, children, className = '' }: Props) {
  const theme = useTheme()
  const merged = `${theme.section} ${className}`.trim()
  return (
    <div className={merged}>
      {title ? (
        <div className="mb-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle ? <p className={`${theme.mutedText} text-sm`}>{subtitle}</p> : null}
        </div>
      ) : null}
      <div className="space-y-4">{children}</div>
    </div>
  )
}

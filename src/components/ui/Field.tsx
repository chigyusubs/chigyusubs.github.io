import React from 'react'
import { useTheme } from '../../lib/themeContext'

type LabelProps = {
  children: React.ReactNode
  className?: string
  htmlFor?: string
}

export function FieldLabel({ children, className = '', htmlFor }: LabelProps) {
  const theme = useTheme()
  const merged = `${theme.label} ${className}`.trim()
  return (
    <label className={merged} htmlFor={htmlFor}>
      {children}
    </label>
  )
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const TextInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', ...rest }, ref) => {
    const theme = useTheme()
    const merged = `${theme.input} ${className}`.trim()
    return <input ref={ref} className={merged} {...rest} />
  },
)
TextInput.displayName = 'TextInput'

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className = '', ...rest }, ref) => {
    const theme = useTheme()
    const merged = `${theme.input} ${className}`.trim()
    return <textarea ref={ref} className={merged} {...rest} />
  },
)
TextArea.displayName = 'TextArea'

type FilePickerProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
  description?: string
  fileName?: string | null
  fileMeta?: string | null
}

export function FilePicker({
  label,
  description,
  fileName,
  fileMeta,
  className = '',
  ...rest
}: FilePickerProps) {
  const theme = useTheme()
  const isDisabled = !!rest.disabled
  const isDark = theme.page.includes('theme-dark')
  const isLight = theme.page.includes('theme-light')
  const focusRingClass =
    isDark
      ? 'focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-stone-950 focus-within:ring-green-400/70'
      : 'focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-orange-50 focus-within:ring-orange-300/70'
  return (
    <label
      className={`relative flex flex-col gap-2 border-2 border-dashed rounded-lg p-4 transition ${
        isDisabled
          ? 'opacity-60 cursor-not-allowed'
          : isDark
            ? 'border-stone-700 hover:border-green-400 hover:bg-stone-900 cursor-pointer'
            : isLight
              ? 'border-orange-100 hover:border-orange-400 hover:bg-orange-50 cursor-pointer'
              : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50 cursor-pointer'
      } ${focusRingClass} ${className}`}
      aria-disabled={isDisabled}
    >
      <span className="text-sm font-medium">{label}</span>
      {description ? <span className={`${theme.mutedText} text-xs`}>{description}</span> : null}
      <div className="flex items-center justify-between">
        <span className={`${theme.mutedText} text-sm`}>
          {isDisabled ? 'Locked while translation runs' : 'Click to choose or drag a file here'}
        </span>
      </div>
      <input
        className={`absolute inset-0 w-full h-full opacity-0 ${isDisabled ? 'pointer-events-none' : 'cursor-pointer'}`}
        type="file"
        {...rest}
      />
      {fileName ? (
        <div className="mt-1 text-sm">
          <span className="font-medium">{fileName}</span>
          {fileMeta ? <span className={`ml-2 ${theme.mutedText}`}>{fileMeta}</span> : null}
        </div>
      ) : null}
    </label>
  )
}

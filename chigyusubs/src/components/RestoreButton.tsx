import React from 'react'
import { Button } from './ui/Button'

type Props = {
  onClick: () => void
  disabled: boolean
  title: string
  children?: React.ReactNode
}

export function RestoreButton({ onClick, disabled, title, children = 'Restore default' }: Props) {
  return (
    <Button
      type="button"
      tone="secondary"
      className="text-xs px-2 py-1"
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  )
}

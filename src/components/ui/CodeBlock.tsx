import React from 'react'
import { useTheme } from '../../lib/themeContext'

type CodeBlockProps = {
    children: React.ReactNode
    className?: string
}

export function CodeBlock({ children, className = '' }: CodeBlockProps) {
    const theme = useTheme()

    return (
        <pre
            className={`p-2 rounded border text-base whitespace-pre-wrap overflow-y-auto ${className}`}
            style={{
                backgroundColor: theme.codeBackground,
                borderColor: theme.borderColor,
            }}
        >
            {children}
        </pre>
    )
}

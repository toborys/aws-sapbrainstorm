import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

interface MermaidDiagramProps {
  source: string
  id?: string
  className?: string
}

// Initialize mermaid once (module-level)
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    background: '#0a0a0f',
    primaryColor: '#1a1a2e',
    primaryTextColor: '#e8e6e0',
    primaryBorderColor: '#2a2a3e',
    lineColor: '#4a9eff',
    secondaryColor: '#16213e',
    tertiaryColor: '#1e2033',
  },
  securityLevel: 'loose',
})

export function MermaidDiagram({ source, id, className = '' }: MermaidDiagramProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [svg, setSvg] = useState<string>('')
  const diagramId = id || `mermaid-${Math.random().toString(36).slice(2, 9)}`

  useEffect(() => {
    if (!source?.trim()) {
      setError('Empty diagram source')
      return
    }
    let cancelled = false
    mermaid
      .render(diagramId, source)
      .then(({ svg }) => {
        if (!cancelled) {
          setSvg(svg)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to render diagram')
        }
      })
    return () => { cancelled = true }
  }, [source, diagramId])

  if (error) {
    return (
      <div className={`p-4 bg-surface-2/60 border border-border rounded-xl ${className}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-danger">Diagram render failed — showing source</span>
          <button
            onClick={() => navigator.clipboard?.writeText(source)}
            className="text-xs text-accent hover:text-accent-hover cursor-pointer"
          >
            Copy source
          </button>
        </div>
        <pre className="text-xs text-text-secondary font-mono overflow-x-auto whitespace-pre-wrap">
          {source}
        </pre>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={`mermaid-container bg-surface-2/30 border border-border rounded-xl p-4 overflow-x-auto ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

import { useEffect, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  X,
  Check,
  Layers,
  Clock,
  AlertTriangle,
  TrendingUp,
  Zap,
  Target,
  Shield,
  Info,
  Cpu,
  Users,
  Rocket,
  Quote,
  Download,
  FileText,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { MermaidDiagram } from '../ui/MermaidDiagram'
import { BRAINSTORM_AGENTS } from '../../config/agents'
import { useUiStore } from '../../stores/uiStore'
import { generateBuildKit } from '../../api/client'
import type { Idea } from '../../types'

interface IdeaModalProps {
  idea: Idea | null
  isOpen: boolean
  onClose: () => void
  isSelected: boolean
  onToggle: (id: string) => void
  variant?: 'vote' | 'manage'
}

type TabKey = 'overview' | 'technical' | 'business' | 'origin' | 'build'

const TABS: { key: TabKey; label: string; icon: typeof Info }[] = [
  { key: 'overview', label: 'Overview', icon: Info },
  { key: 'technical', label: 'Technical', icon: Cpu },
  { key: 'business', label: 'Business', icon: TrendingUp },
  { key: 'origin', label: 'AI Origin', icon: Users },
  { key: 'build', label: 'Build Kit', icon: Rocket },
]

const categoryColors: Record<string, string> = {
  'Monitoring & Observability': '#4a9eff',
  'Security & Compliance': '#f87171',
  'Automation': '#34d399',
  'Migration & Modernization': '#fbbf24',
  'Analytics & Insights': '#a78bfa',
  'Performance Testing': '#ff9900',
  'Cloud & Infrastructure': '#4a9eff',
  'SAP Solutions': '#fbbf24',
  'AI & Machine Learning': '#a78bfa',
  'Cybersecurity': '#f87171',
  'SaaS Products': '#34d399',
  'Professional Services': '#94a3b8',
  'Sales & Go-to-Market': '#fbbf24',
  'Customer Success': '#4a9eff',
  'Internal Tools & Automation': '#94a3b8',
  'Data & Analytics': '#4a9eff',
  // Legacy shorter keys
  Monitoring: '#4a9eff',
  Security: '#f87171',
  Analytics: '#a78bfa',
  Performance: '#ff9900',
}

const complexityConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  low: { label: 'Low', variant: 'success' },
  medium: { label: 'Medium', variant: 'warning' },
  high: { label: 'High', variant: 'danger' },
}

const riskConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  low: { label: 'Low', variant: 'success' },
  medium: { label: 'Medium', variant: 'warning' },
  high: { label: 'High', variant: 'danger' },
}

export function IdeaModal({
  idea,
  isOpen,
  onClose,
  isSelected,
  onToggle,
  variant = 'vote',
}: IdeaModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [isGenerating, setIsGenerating] = useState(false)
  const [buildKitResult, setBuildKitResult] = useState<{
    files: string[]
    presignedUrl: string
    expiresAt: string
  } | null>(null)
  const { addToast } = useUiStore()
  const navigate = useNavigate()

  const handleEvolveIdea = () => {
    if (!idea) return
    onClose()
    navigate(`/team/brainstorm?evolve=${idea.id}`)
  }

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleEscape])

  // Reset tab + build state when the modal opens for a new idea
  useEffect(() => {
    if (isOpen && idea) {
      setActiveTab('overview')
      setBuildKitResult(null)
    }
  }, [isOpen, idea?.id])

  if (!isOpen || !idea) return null

  const catColor = categoryColors[idea.category] || '#4a9eff'

  const handleGenerateBuildKit = async () => {
    if (!idea) return
    setIsGenerating(true)
    addToast({ type: 'info', message: 'Generating build kit...' })
    try {
      const result = await generateBuildKit(idea.id)
      setBuildKitResult({
        files: result.files,
        presignedUrl: result.presignedUrl,
        expiresAt: result.expiresAt,
      })
      addToast({ type: 'success', message: 'Build kit ready — downloading...' })
      window.location.href = result.presignedUrl
    } catch (err) {
      addToast({
        type: 'error',
        message: `Build kit failed: ${(err as Error).message} — retry?`,
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col rounded-2xl bg-surface/95 backdrop-blur-2xl border border-border shadow-2xl shadow-black/40 animate-scale-in">
        {/* Gradient top accent */}
        <div
          className="absolute inset-x-0 top-0 h-px rounded-t-2xl"
          style={{
            background: `linear-gradient(90deg, transparent, ${catColor}60, transparent)`,
          }}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-xl bg-surface-2/80 text-text-muted hover:text-text hover:bg-surface-3 transition-all duration-200 cursor-pointer backdrop-blur-sm border border-border"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero header */}
        <div className="px-8 pt-8 pb-5 shrink-0">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge variant="category" categoryColor={catColor} size="md">
              {idea.category}
            </Badge>
            {idea.complexity && (
              <Badge
                variant={complexityConfig[idea.complexity]?.variant || 'warning'}
                size="md"
              >
                {complexityConfig[idea.complexity]?.label || idea.complexity} complexity
              </Badge>
            )}
          </div>

          <h1 className="font-display text-3xl text-text leading-tight tracking-tight mb-1.5 pr-12">
            {idea.name}
          </h1>
          {idea.tagline && (
            <p className="text-lg text-accent italic leading-relaxed">
              {idea.tagline}
            </p>
          )}
        </div>

        {/* Tab bar */}
        <div className="px-8 border-b border-border shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm font-medium
                    transition-all duration-200 cursor-pointer
                    border-b-2 -mb-px whitespace-nowrap
                    ${
                      isActive
                        ? 'text-accent border-accent'
                        : 'text-text-muted border-transparent hover:text-text-secondary'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab content - scrollable */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {activeTab === 'overview' && (
            <OverviewTab
              idea={idea}
              variant={variant}
              isSelected={isSelected}
              onToggle={onToggle}
            />
          )}
          {activeTab === 'technical' && <TechnicalTab idea={idea} />}
          {activeTab === 'business' && <BusinessTab idea={idea} />}
          {activeTab === 'origin' && <AiOriginTab idea={idea} />}
          {activeTab === 'build' && (
            <BuildKitTab
              idea={idea}
              isGenerating={isGenerating}
              result={buildKitResult}
              onGenerate={handleGenerateBuildKit}
              onEvolve={handleEvolveIdea}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// =============================================================
// TABS
// =============================================================

function OverviewTab({
  idea,
  variant,
  isSelected,
  onToggle,
}: {
  idea: Idea
  variant: 'vote' | 'manage'
  isSelected: boolean
  onToggle: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-7">
        {/* Problem */}
        <Section title="Problem" icon={<Target className="w-4 h-4 text-accent" />}>
          <div className="border-l-2 border-accent/30 pl-4">
            <p className="text-sm text-text leading-relaxed">
              {idea.problem || '—'}
            </p>
          </div>
        </Section>

        {/* Solution */}
        <Section title="Solution" icon={<Zap className="w-4 h-4 text-purple" />}>
          <p className="text-sm text-text leading-relaxed">
            {idea.solution || '—'}
          </p>
        </Section>
      </div>

      {/* Side summary */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
          Summary
        </h3>

        <QuickFact
          icon={<Layers className="w-4 h-4" />}
          label="Complexity"
          value={complexityConfig[idea.complexity]?.label || idea.complexity || '—'}
          variant={complexityConfig[idea.complexity]?.variant}
        />
        <QuickFact
          icon={<Clock className="w-4 h-4" />}
          label="MVP Time"
          value={idea.mvpTime || '—'}
        />
        <QuickFact
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Risk"
          value={riskConfig[idea.risk]?.label || idea.risk || '—'}
          variant={riskConfig[idea.risk]?.variant}
        />
        <QuickFact
          icon={<TrendingUp className="w-4 h-4" />}
          label="Estimated MRR"
          value={idea.mrr || '—'}
          highlight
        />
        <QuickFact
          icon={<Zap className="w-4 h-4" />}
          label="Model"
          value={idea.model || '—'}
        />
        <QuickFact
          icon={<Shield className="w-4 h-4" />}
          label="Self-service"
          value={idea.selfService ? 'Yes' : 'No'}
        />

        {variant === 'vote' && (
          <div className="pt-3">
            <button
              onClick={() => onToggle(idea.id)}
              className={`
                w-full flex items-center justify-center gap-2
                py-3 rounded-xl text-sm font-semibold
                transition-all duration-300 cursor-pointer
                active:scale-[0.98]
                ${
                  isSelected
                    ? 'bg-accent/15 text-accent border border-accent/30 hover:bg-accent/20'
                    : 'bg-gradient-to-r from-accent to-accent-hover text-white shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30'
                }
              `}
            >
              {isSelected ? (
                <>
                  <Check className="w-4 h-4" />
                  Deselect
                </>
              ) : (
                'Select this idea'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function TechnicalTab({ idea }: { idea: Idea }) {
  const complexity = complexityConfig[idea.complexity]
  const risk = riskConfig[idea.risk]

  return (
    <div className="space-y-7">
      {/* Architecture diagram */}
      <Section
        title="Architecture Diagram"
        icon={<Cpu className="w-4 h-4 text-accent" />}
      >
        {idea.architectureDiagram?.trim() ? (
          <MermaidDiagram source={idea.architectureDiagram} />
        ) : (
          <div className="p-6 bg-surface-2/40 border border-border rounded-xl text-center text-sm text-text-muted">
            No architecture diagram available
          </div>
        )}
      </Section>

      {/* AWS services */}
      <Section
        title="AWS Services"
        icon={<Cpu className="w-4 h-4 text-orange" />}
      >
        {idea.awsServices && idea.awsServices.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {idea.awsServices.map((svc) => (
              <span
                key={svc}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-orange/10 text-orange border border-orange/20"
              >
                {svc}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">—</p>
        )}
      </Section>

      {/* SAP modules */}
      <Section
        title="SAP Modules"
        icon={<Layers className="w-4 h-4 text-accent" />}
      >
        {idea.sapModules && idea.sapModules.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {idea.sapModules.map((mod) => (
              <span
                key={mod}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-accent/10 text-accent border border-accent/20"
              >
                {mod}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">—</p>
        )}
      </Section>

      {/* Text architecture (if present as freeform text) */}
      {idea.architecture && (
        <Section
          title="Architecture Notes"
          icon={<FileText className="w-4 h-4 text-text-secondary" />}
        >
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
            {idea.architecture}
          </p>
        </Section>
      )}

      {/* Complexity / Risk / MVP trio */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
        <TrioCard
          icon={<Layers className="w-4 h-4" />}
          label="Complexity"
          value={complexity?.label || idea.complexity || '—'}
          variant={complexity?.variant}
        />
        <TrioCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Risk"
          value={risk?.label || idea.risk || '—'}
          variant={risk?.variant}
        />
        <TrioCard
          icon={<Clock className="w-4 h-4" />}
          label="MVP Time"
          value={idea.mvpTime || '—'}
        />
      </div>

      {/* Risk note */}
      {idea.riskNote && (
        <Section
          title="Risk Notes"
          icon={<AlertTriangle className="w-4 h-4 text-warning" />}
        >
          <div className="p-4 rounded-xl bg-warning/5 border border-warning/10">
            <p className="text-sm text-text-secondary leading-relaxed">
              {idea.riskNote}
            </p>
          </div>
        </Section>
      )}
    </div>
  )
}

function BusinessTab({ idea }: { idea: Idea }) {
  const hasCost =
    idea.costEstimate &&
    (idea.costEstimate.devEur !== undefined ||
      idea.costEstimate.prodEur !== undefined ||
      idea.costEstimate.assumptions)

  return (
    <div className="space-y-7">
      {/* Target buyer */}
      <Section
        title="Target Buyer"
        icon={<Target className="w-4 h-4 text-accent" />}
      >
        <p className="text-sm text-text leading-relaxed">
          {idea.targetBuyer || '—'}
        </p>
      </Section>

      {/* Customer perspective */}
      <Section
        title="Customer Perspective"
        icon={<Quote className="w-4 h-4 text-purple" />}
      >
        {idea.customerPerspective ? (
          <blockquote className="border-l-4 border-purple/40 pl-5 py-1 italic text-base text-text-secondary leading-relaxed">
            &ldquo;{idea.customerPerspective}&rdquo;
          </blockquote>
        ) : (
          <p className="text-sm text-text-muted">—</p>
        )}
      </Section>

      {/* Differentiator */}
      <Section
        title="Differentiator"
        icon={<TrendingUp className="w-4 h-4 text-success" />}
      >
        <p className="text-sm text-text leading-relaxed">
          {idea.differentiator || '—'}
        </p>
      </Section>

      {/* Pricing model */}
      <Section
        title="Pricing Model"
        icon={<Zap className="w-4 h-4 text-accent" />}
      >
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-lg bg-surface-2/70 border border-border text-sm text-text">
            {idea.model || '—'}
          </span>
          {idea.mrr && (
            <span className="flex items-center gap-1 text-sm text-success font-medium">
              <TrendingUp className="w-4 h-4" />
              {idea.mrr}
            </span>
          )}
        </div>
      </Section>

      {/* Cost estimate */}
      <Section
        title="Cost Estimate"
        icon={<FileText className="w-4 h-4 text-orange" />}
      >
        {hasCost ? (
          <div className="overflow-hidden rounded-xl border border-border bg-surface-2/40">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-4 py-3 text-text-muted text-xs uppercase tracking-wider w-1/3">
                    Dev (EUR / mo)
                  </td>
                  <td className="px-4 py-3 text-text font-mono">
                    {idea.costEstimate?.devEur !== undefined
                      ? `€${idea.costEstimate.devEur.toLocaleString()}`
                      : '—'}
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-4 py-3 text-text-muted text-xs uppercase tracking-wider">
                    Prod (EUR / mo)
                  </td>
                  <td className="px-4 py-3 text-text font-mono">
                    {idea.costEstimate?.prodEur !== undefined
                      ? `€${idea.costEstimate.prodEur.toLocaleString()}`
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-text-muted text-xs uppercase tracking-wider align-top">
                    Assumptions
                  </td>
                  <td className="px-4 py-3 text-text-secondary leading-relaxed">
                    {idea.costEstimate?.assumptions || '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-text-muted">Cost estimate not available</p>
        )}
      </Section>
    </div>
  )
}

function AiOriginTab({ idea }: { idea: Idea }) {
  const champions = idea.championedBy || []
  const challengers = idea.challengedBy || []

  return (
    <div className="space-y-7">
      {/* Champions */}
      <Section
        title="Championed By"
        icon={<Users className="w-4 h-4 text-success" />}
      >
        {champions.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {champions.map((agentId) => (
              <AgentAvatar key={agentId} agentId={agentId} tint="green" />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">—</p>
        )}
      </Section>

      {/* Challengers */}
      <Section
        title="Challenged By"
        icon={<AlertTriangle className="w-4 h-4 text-danger" />}
      >
        {challengers.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {challengers.map((agentId) => (
              <AgentAvatar key={agentId} agentId={agentId} tint="red" />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">—</p>
        )}
      </Section>

      {/* Panel notes */}
      <Section
        title="Panel Notes"
        icon={<FileText className="w-4 h-4 text-accent" />}
      >
        {idea.panelNotes ? (
          <div className="p-4 rounded-xl bg-surface-2/40 border border-border">
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
              {idea.panelNotes}
            </p>
          </div>
        ) : (
          <p className="text-sm text-text-muted">—</p>
        )}
      </Section>

      {/* Source session */}
      {idea.sourceSessionId && (
        <Section
          title="Source Session"
          icon={<Info className="w-4 h-4 text-text-muted" />}
        >
          <code className="px-3 py-1.5 rounded-lg bg-surface-2/70 border border-border text-xs font-mono text-text-secondary">
            {idea.sourceSessionId}
          </code>
        </Section>
      )}
    </div>
  )
}

function BuildKitTab({
  idea,
  isGenerating,
  result,
  onGenerate,
  onEvolve,
}: {
  idea: Idea
  isGenerating: boolean
  result: { files: string[]; presignedUrl: string; expiresAt: string } | null
  onGenerate: () => void
  onEvolve: () => void
}) {
  const defaultFiles = [
    'README.md',
    'architecture.mmd',
    'infrastructure/main.tf',
    'infrastructure/variables.tf',
    'pitch-deck.md',
    'cost-estimate.json',
    'idea.json',
  ]
  const filesToShow = result?.files || defaultFiles

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 border border-accent/25 mb-4">
          <Rocket className="w-7 h-7 text-accent" />
        </div>
        <h2 className="font-display text-2xl text-text mb-2 tracking-tight">
          Promote to Build
        </h2>
        <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
          Generate a complete build kit for{' '}
          <span className="text-accent">{idea.name}</span> — architecture
          diagram, Terraform skeleton, pitch deck, cost estimate, and source
          metadata — packaged as a downloadable ZIP.
        </p>
      </div>

      {/* Files included */}
      <div className="rounded-xl border border-border bg-surface-2/40 p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-text-muted" />
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Included files
          </h3>
        </div>
        <ul className="space-y-1.5">
          {filesToShow.map((file) => (
            <li
              key={file}
              className="flex items-center gap-2 text-sm text-text-secondary font-mono"
            >
              <span className="text-text-muted">•</span>
              {file}
            </li>
          ))}
        </ul>
      </div>

      {/* Action */}
      <div className="flex flex-col items-center gap-3">
        <Button
          variant="primary"
          size="lg"
          onClick={onGenerate}
          disabled={isGenerating}
          icon={
            isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Rocket className="w-4 h-4" />
            )
          }
        >
          {isGenerating ? 'Generating build kit...' : 'Generate Build Kit'}
        </Button>

        {/* Evolve this idea */}
        <div className="w-full max-w-md pt-2 mt-2 border-t border-border">
          <p className="text-xs text-text-muted text-center mb-3 leading-relaxed">
            Start a new brainstorm session that builds on this idea — the panel
            will propose extensions, adjacent opportunities, and pivots.
          </p>
          <div className="flex justify-center">
            <Button
              variant="secondary"
              size="md"
              onClick={onEvolve}
              icon={<Sparkles className="w-4 h-4" />}
            >
              Evolve with Advisory Panel
            </Button>
          </div>
        </div>

        {result && (
          <div className="flex flex-col items-center gap-2 mt-2 p-3 rounded-xl bg-success/5 border border-success/15">
            <div className="flex items-center gap-2 text-sm text-success">
              <Check className="w-4 h-4" />
              Build kit ready
            </div>
            <a
              href={result.presignedUrl}
              className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download again
            </a>
            <p className="text-[11px] text-text-muted">
              Link expires{' '}
              {new Date(result.expiresAt).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================
// SHARED SUB-COMPONENTS
// =============================================================

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

function QuickFact({
  icon,
  label,
  value,
  variant,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string
  variant?: 'success' | 'warning' | 'danger'
  highlight?: boolean
}) {
  const colorMap = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-2/50 border border-border">
      <span className="text-text-muted">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-text-muted">{label}</p>
        <p
          className={`text-sm font-medium truncate ${
            highlight
              ? 'text-success'
              : variant
              ? colorMap[variant]
              : 'text-text'
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

function TrioCard({
  icon,
  label,
  value,
  variant,
}: {
  icon: React.ReactNode
  label: string
  value: string
  variant?: 'success' | 'warning' | 'danger'
}) {
  const colorMap = {
    success: 'text-success border-success/20 bg-success/5',
    warning: 'text-warning border-warning/20 bg-warning/5',
    danger: 'text-danger border-danger/20 bg-danger/5',
  }
  const tone = variant ? colorMap[variant] : 'text-text border-border bg-surface-2/50'

  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex items-center gap-2 mb-1.5 text-text-muted">
        {icon}
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-display tracking-tight">{value}</p>
    </div>
  )
}

function AgentAvatar({
  agentId,
  tint,
}: {
  agentId: string
  tint: 'green' | 'red'
}) {
  const agent = BRAINSTORM_AGENTS.find((a) => a.id === agentId)

  // Fallback for unknown agent ids
  const name = agent?.name || agentId
  const initials =
    agent?.avatar ||
    agentId
      .split(/[-_\s]/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()
  const bgColor = agent?.color || '#64748b'

  const ring =
    tint === 'green'
      ? 'ring-2 ring-success/40 shadow-[0_0_14px_rgba(52,211,153,0.35)]'
      : 'ring-2 ring-danger/40 saturate-75'

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-2/50 border border-border">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 ${ring}`}
        style={{ backgroundColor: bgColor }}
      >
        {initials}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-text font-medium truncate">{name}</p>
        {agent?.role && (
          <p className="text-[11px] text-text-muted truncate">{agent.role}</p>
        )}
      </div>
    </div>
  )
}

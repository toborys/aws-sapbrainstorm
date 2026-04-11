import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
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
  Server,
  Sparkles,
} from 'lucide-react'
import { Badge } from '../ui/Badge'
import type { Idea } from '../../types'

interface IdeaModalProps {
  idea: Idea | null
  isOpen: boolean
  onClose: () => void
  isSelected: boolean
  onToggle: (id: string) => void
  variant?: 'vote' | 'manage'
}

const categoryColors: Record<string, string> = {
  Monitoring: '#4a9eff',
  Security: '#f87171',
  Automation: '#34d399',
  Migration: '#fbbf24',
  Analytics: '#a78bfa',
  Performance: '#ff9900',
}

const complexityConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  low: { label: 'Niska', variant: 'success' },
  medium: { label: 'Srednia', variant: 'warning' },
  high: { label: 'Wysoka', variant: 'danger' },
}

const riskConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  low: { label: 'Niskie', variant: 'success' },
  medium: { label: 'Srednie', variant: 'warning' },
  high: { label: 'Wysokie', variant: 'danger' },
}

const potentialConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  low: { label: 'Niski', variant: 'danger' },
  medium: { label: 'Sredni', variant: 'warning' },
  high: { label: 'Wysoki', variant: 'success' },
}

function extractAwsServices(text: string): string[] {
  const awsPatterns = [
    'Lambda', 'S3', 'DynamoDB', 'CloudWatch', 'CloudFront', 'API Gateway',
    'EventBridge', 'SQS', 'SNS', 'Step Functions', 'ECS', 'EKS', 'Fargate',
    'RDS', 'Aurora', 'Redshift', 'Kinesis', 'Glue', 'Athena', 'SageMaker',
    'Bedrock', 'QuickSight', 'Cognito', 'IAM', 'KMS', 'WAF', 'GuardDuty',
    'Config', 'CloudTrail', 'Systems Manager', 'CodePipeline', 'CodeBuild',
    'EC2', 'VPC', 'Route 53', 'ELB', 'ALB', 'NLB', 'ElastiCache',
    'AppSync', 'Amplify', 'Connect', 'Lex', 'Translate', 'Comprehend',
    'Textract', 'Rekognition', 'Secrets Manager', 'Parameter Store',
    'Cost Explorer', 'Trusted Advisor',
  ]

  const found: string[] = []
  for (const svc of awsPatterns) {
    if (text.includes(svc) && !found.includes(svc)) {
      found.push(svc)
    }
  }
  return found
}

export function IdeaModal({
  idea,
  isOpen,
  onClose,
  isSelected,
  onToggle,
  variant = 'vote',
}: IdeaModalProps) {
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

  if (!isOpen || !idea) return null

  const catColor = categoryColors[idea.category] || '#4a9eff'
  const complexity = complexityConfig[idea.complexity] || complexityConfig.medium
  const risk = riskConfig[idea.risk] || riskConfig.medium
  const potential = potentialConfig[idea.potential] || potentialConfig.medium
  const awsServices = extractAwsServices(idea.architecture || '')

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-surface/95 backdrop-blur-2xl border border-border shadow-2xl shadow-black/40 animate-scale-in">
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
          className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-surface-2/80 text-text-muted hover:text-text hover:bg-surface-3 transition-all duration-200 cursor-pointer backdrop-blur-sm border border-border"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero section */}
        <div className="px-8 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <Badge variant="category" categoryColor={catColor} size="md">
              {idea.category}
            </Badge>
            <Badge variant={complexity.variant} size="md">
              {complexity.label} zlozonosc
            </Badge>
          </div>

          <h1 className="font-display text-3xl text-text leading-tight tracking-tight mb-2">
            {idea.name}
          </h1>
          <p className="text-lg text-accent italic leading-relaxed">
            {idea.tagline}
          </p>
        </div>

        {/* Two column layout */}
        <div className="px-8 pb-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Problem section */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                  Problem
                </h2>
              </div>
              <div className="border-l-2 border-accent/30 pl-4">
                <p className="text-sm text-text leading-relaxed">{idea.problem}</p>
              </div>
            </section>

            {/* Solution section */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-purple" />
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                  Rozwiazanie
                </h2>
              </div>
              <p className="text-sm text-text leading-relaxed">{idea.solution}</p>
            </section>

            {/* Architecture section */}
            {idea.architecture && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Server className="w-4 h-4 text-orange" />
                  <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                    Architektura AWS
                  </h2>
                </div>
                {awsServices.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {awsServices.map((svc) => (
                      <span
                        key={svc}
                        className="px-2 py-0.5 rounded-lg text-xs font-medium bg-orange/10 text-orange border border-orange/15"
                      >
                        {svc}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-sm text-text-secondary leading-relaxed">{idea.architecture}</p>
              </section>
            )}

            {/* Risk section */}
            {idea.riskNote && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                    Ryzyko
                  </h2>
                  <Badge variant={risk.variant} size="sm">
                    {risk.label}
                  </Badge>
                </div>
                <div className="p-4 rounded-xl bg-warning/5 border border-warning/10">
                  <p className="text-sm text-text-secondary leading-relaxed">{idea.riskNote}</p>
                </div>
              </section>
            )}
          </div>

          {/* Side panel -- quick facts */}
          <div className="space-y-4">
            <div className="sticky top-4 space-y-3">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
                Podsumowanie
              </h3>

              <QuickFact
                icon={<Layers className="w-4 h-4" />}
                label="Zlozonosc"
                value={complexity.label}
                variant={complexity.variant}
              />
              <QuickFact
                icon={<Clock className="w-4 h-4" />}
                label="Czas MVP"
                value={idea.mvpTime}
              />
              <QuickFact
                icon={<AlertTriangle className="w-4 h-4" />}
                label="Ryzyko"
                value={risk.label}
                variant={risk.variant}
              />
              <QuickFact
                icon={<TrendingUp className="w-4 h-4" />}
                label="Szacowany MRR"
                value={idea.mrr}
                highlight
              />
              <QuickFact
                icon={<Zap className="w-4 h-4" />}
                label="Model"
                value={idea.model}
              />
              <QuickFact
                icon={<Shield className="w-4 h-4" />}
                label="Self-service"
                value={idea.selfService ? 'Tak' : 'Nie'}
              />
              <QuickFact
                icon={<Target className="w-4 h-4" />}
                label="Potencjal"
                value={potential.label}
                variant={potential.variant}
              />

              {/* Action button */}
              {variant === 'vote' && (
                <div className="pt-4">
                  <button
                    onClick={() => onToggle(idea.id)}
                    className={`
                      w-full flex items-center justify-center gap-2
                      py-3 rounded-xl text-sm font-semibold
                      transition-all duration-300 cursor-pointer
                      active:scale-[0.98]
                      ${isSelected
                        ? 'bg-accent/15 text-accent border border-accent/30 hover:bg-accent/20'
                        : 'bg-gradient-to-r from-accent to-accent-hover text-white shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30'
                      }
                    `}
                  >
                    {isSelected ? (
                      <>
                        <Check className="w-4 h-4" />
                        Odznacz
                      </>
                    ) : (
                      'Wybierz ten pomysl'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
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
            highlight ? 'text-success' : variant ? colorMap[variant] : 'text-text'
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

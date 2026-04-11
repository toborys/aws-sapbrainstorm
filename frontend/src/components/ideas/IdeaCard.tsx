import { useState } from 'react'
import {
  Check,
  ChevronRight,
  GripVertical,
  Eye,
  EyeOff,
  Pencil,
  AlertTriangle,
  Clock,
  Layers,
  TrendingUp,
} from 'lucide-react'
import { Badge } from '../ui/Badge'
import type { Idea } from '../../types'

interface IdeaCardProps {
  idea: Idea
  index: number
  selected?: boolean
  onSelect?: () => void
  onViewDetails?: () => void
  variant?: 'vote' | 'manage'
  onToggleStatus?: (id: string) => void
  onEdit?: (idea: Idea) => void
}

const categoryColors: Record<string, string> = {
  Monitoring: '#4a9eff',
  Security: '#f87171',
  Automation: '#34d399',
  Migration: '#fbbf24',
  Analytics: '#a78bfa',
  Performance: '#ff9900',
}

const complexityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Niska', color: 'text-success' },
  medium: { label: 'Srednia', color: 'text-warning' },
  high: { label: 'Wysoka', color: 'text-danger' },
}

const riskConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Niskie', color: 'text-success' },
  medium: { label: 'Srednie', color: 'text-warning' },
  high: { label: 'Wysokie', color: 'text-danger' },
}

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  active: { label: 'Aktywny', variant: 'success' },
  hidden: { label: 'Ukryty', variant: 'warning' },
  archived: { label: 'Zarchiwizowany', variant: 'danger' },
}

export function IdeaCard({
  idea,
  index,
  selected = false,
  onSelect,
  onViewDetails,
  variant = 'vote',
  onToggleStatus,
  onEdit,
}: IdeaCardProps) {
  const [showMore, setShowMore] = useState(false)
  const catColor = categoryColors[idea.category] || '#4a9eff'
  const complexity = complexityConfig[idea.complexity] || complexityConfig.medium
  const risk = riskConfig[idea.risk] || riskConfig.medium
  const status = statusConfig[idea.status] || statusConfig.active

  const isManage = variant === 'manage'

  return (
    <div
      className={`
        group relative
        bg-surface/60 backdrop-blur-xl
        border rounded-2xl
        transition-all duration-500 ease-out
        animate-fade-in
        ${selected
          ? 'border-accent/40 animate-selected-pulse'
          : 'border-border hover:border-border-hover'
        }
        ${isManage && idea.status === 'hidden' ? 'opacity-60' : ''}
      `}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Gradient top accent line */}
      <div
        className="absolute inset-x-0 top-0 h-px rounded-t-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `linear-gradient(90deg, transparent, ${catColor}40, transparent)`,
        }}
      />

      {/* Selected checkmark overlay */}
      {selected && (
        <div className="absolute -top-2 -right-2 z-10 w-7 h-7 rounded-full bg-accent flex items-center justify-center shadow-lg shadow-accent/30">
          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
        </div>
      )}

      {/* Card content */}
      <div className="p-5 pb-4">
        {/* Top row: number badge + category + manage actions */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            {isManage && (
              <div className="cursor-grab active:cursor-grabbing text-text-muted hover:text-text-secondary transition-colors">
                <GripVertical className="w-4 h-4" />
              </div>
            )}
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-surface-2 text-[11px] font-mono text-text-muted border border-border">
              {idea.order || index + 1}
            </span>
            <Badge variant="category" categoryColor={catColor} size="sm">
              {idea.category}
            </Badge>
            {isManage && (
              <Badge variant={status.variant} size="sm">
                {status.label}
              </Badge>
            )}
          </div>

          {/* Manage actions */}
          {isManage && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={(e) => { e.stopPropagation(); onToggleStatus?.(idea.id) }}
                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-all duration-200 cursor-pointer"
                title={idea.status === 'active' ? 'Ukryj' : 'Pokaz'}
              >
                {idea.status === 'active' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit?.(idea) }}
                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-all duration-200 cursor-pointer"
                title="Edytuj"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Product name -- hero typography */}
        <h3
          className="font-display text-xl text-text leading-tight mb-1.5 tracking-tight cursor-pointer group-hover:text-white transition-colors duration-300"
          onClick={onViewDetails}
        >
          {idea.name}
        </h3>

        {/* Tagline */}
        <p className="text-sm text-accent italic mb-3 leading-relaxed">
          {idea.tagline}
        </p>

        {/* Problem excerpt */}
        <div className="mb-4">
          <p className={`text-xs text-text-secondary leading-relaxed ${showMore ? '' : 'line-clamp-2'}`}>
            {idea.problem}
          </p>
          {idea.problem.length > 120 && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowMore(!showMore) }}
              className="text-[11px] text-accent/70 hover:text-accent mt-1 cursor-pointer transition-colors"
            >
              {showMore ? 'mniej' : 'wiecej'}
            </button>
          )}
        </div>

        {/* Info pills row */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-2/80 text-[11px] font-medium ${complexity.color}`}>
            <Layers className="w-3 h-3" />
            {complexity.label}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-2/80 text-[11px] font-medium text-text-secondary">
            <Clock className="w-3 h-3" />
            {idea.mvpTime}
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-2/80 text-[11px] font-medium ${risk.color}`}>
            <AlertTriangle className="w-3 h-3" />
            {risk.label}
          </span>
        </div>

        {/* MRR + model */}
        <div className="flex items-center justify-between text-[11px] mb-4">
          <span className="flex items-center gap-1 text-success font-medium">
            <TrendingUp className="w-3 h-3" />
            {idea.mrr}
          </span>
          <span className="text-text-muted">
            {idea.model}
          </span>
        </div>

        {/* AWS services pills (extract from architecture text) */}
        {idea.architecture && (
          <div className="flex flex-wrap gap-1 mb-4">
            {extractAwsServices(idea.architecture).slice(0, 4).map((svc) => (
              <span
                key={svc}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange/10 text-orange border border-orange/15"
              >
                {svc}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {variant === 'vote' && (
        <div className="px-5 pb-4 flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onSelect?.() }}
            className={`
              flex-1 flex items-center justify-center gap-2
              py-2.5 rounded-xl text-sm font-medium
              transition-all duration-300 ease-out cursor-pointer
              active:scale-[0.98]
              ${selected
                ? 'bg-accent/15 text-accent border border-accent/30 hover:bg-accent/20'
                : 'bg-surface-2/80 text-text-secondary border border-border hover:border-border-hover hover:text-text hover:bg-surface-3/80'
              }
            `}
          >
            {selected ? (
              <>
                <Check className="w-4 h-4" />
                Odznacz
              </>
            ) : (
              'Wybierz'
            )}
          </button>
          <button
            onClick={onViewDetails}
            className="p-2.5 rounded-xl bg-surface-2/80 text-text-muted border border-border hover:border-border-hover hover:text-text transition-all duration-200 cursor-pointer active:scale-[0.98]"
            title="Szczegoly"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Extract AWS service names from architecture description text.
 * Looks for common AWS service name patterns.
 */
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

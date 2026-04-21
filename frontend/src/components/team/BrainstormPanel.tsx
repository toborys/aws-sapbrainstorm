import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Sparkles,
  Brain,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  Plus,
  History,
  Users,
  Zap,
  Shield,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  Download,
} from 'lucide-react'
import { AppShell } from '../layout/AppShell'
import { TopNav } from '../layout/TopNav'
import { Sidebar } from '../layout/Sidebar'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { Textarea } from '../ui/Textarea'
import { useIdeasStore } from '../../stores/ideasStore'
import { useUiStore } from '../../stores/uiStore'
import { startBrainstorm, getBrainstormStatus, createIdea, DuplicateIdeaError } from '../../api/client'
import { DuplicateWarningDialog } from '../ideas/DuplicateWarningDialog'
import { BRAINSTORM_AGENTS } from '../../config/agents'
import type { GeneratedIdea } from '../../types/agents'
import type { IdeaCategory } from '../../types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES: (IdeaCategory | 'Any')[] = [
  'Any',
  'Cloud & Infrastructure',
  'SAP Solutions',
  'AI & Machine Learning',
  'Cybersecurity',
  'SaaS Products',
  'Professional Services',
  'Sales & Go-to-Market',
  'Customer Success',
  'Internal Tools & Automation',
  'Data & Analytics',
]

type IdeaTypeFilter = 'all' | 'technical' | 'business' | 'sales' | 'operations'

const IDEA_TYPE_OPTIONS: { value: IdeaTypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'technical', label: 'Technical' },
  { value: 'business', label: 'Business' },
  { value: 'sales', label: 'Sales' },
  { value: 'operations', label: 'Operations' },
]

const IDEA_COUNT_OPTIONS = [3, 5, 10] as const

type ViewMode = 'config' | 'generating' | 'results'

// Agent group labels
const AGENT_GROUPS: { label: string; ids: string[] }[] = [
  {
    label: 'Advisory Panel',
    ids: ['principal-architect', 'product-owner', 'devils-advocate'],
  },
]

// ---------------------------------------------------------------------------
// Session history types
// ---------------------------------------------------------------------------

interface BrainstormResult {
  ideas: GeneratedIdea[]
  discussion: string
  agentCount: number
  sessionId: string
}

interface SessionHistoryItem {
  id: string
  category: string
  agentCount: number
  ideaCount: number
  createdAt: string
  agentIds: string[]
  result: BrainstormResult
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BrainstormPanel() {
  const { ideas, fetchIdeas } = useIdeasStore()
  const { addToast } = useUiStore()
  const navigate = useNavigate()

  // Dedupe warning dialog state. `pending` holds the idea the user tried to
  // save that triggered the 409 — when they click "Save anyway" we retry
  // with force=true.
  const [duplicatePrompt, setDuplicatePrompt] = useState<{
    idea: GeneratedIdea
    idx: number
    existing: { id: string; name: string; tagline: string }
    similarity: number
  } | null>(null)
  const [forceSaving, setForceSaving] = useState(false)

  // Evolve-from-idea query param support
  const [searchParams] = useSearchParams()
  const evolveFromIdeaId = searchParams.get('evolve')
  const evolveSeed = evolveFromIdeaId
    ? ideas.find((i) => i.id === evolveFromIdeaId) || null
    : null

  // Agent selection — persisted to localStorage
  // Panel is the same 3-expert advisory panel; default is all selected
  const VALID_AGENT_IDS = new Set(BRAINSTORM_AGENTS.map((a) => a.id))
  const DEFAULT_AGENTS = BRAINSTORM_AGENTS.map((a) => a.id)
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('brainstorm-selected-agents')
      if (saved) {
        const arr = JSON.parse(saved) as string[]
        if (Array.isArray(arr)) {
          // Filter out any stale IDs from previous 12-agent config
          const valid = arr.filter((id) => VALID_AGENT_IDS.has(id))
          if (valid.length > 0) return new Set(valid)
        }
      }
    } catch {
      // Ignore
    }
    return new Set(DEFAULT_AGENTS)
  })

  // Config
  const [category, setCategory] = useState<IdeaCategory | 'Any'>('Any')
  const [ideaType, setIdeaType] = useState<IdeaTypeFilter>('all')
  const [customPrompt, setCustomPrompt] = useState(() => {
    try {
      return sessionStorage.getItem('brainstorm-custom-prompt') || ''
    } catch {
      return ''
    }
  })
  const [ideaCount, setIdeaCount] = useState<number>(5)

  // View / Generation state — restore from localStorage if results exist
  const [brainstormResult, setBrainstormResult] = useState<BrainstormResult | null>(() => {
    try {
      const saved = localStorage.getItem('brainstorm-current-result')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem('brainstorm-current-result')
      return saved ? 'results' : 'config'
    } catch {
      return 'config'
    }
  })
  const [addingIdea, setAddingIdea] = useState<string | null>(null)
  const [addingAll, setAddingAll] = useState(false)
  const [litAgentIdx, setLitAgentIdx] = useState(0)
  const litInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  // Stage progress (from backend status endpoint during generation)
  const [currentStage, setCurrentStage] = useState<string>('')
  const [kbContextCount, setKbContextCount] = useState<number>(0)

  // Expanded idea cards
  const [expandedProblems, setExpandedProblems] = useState<Set<number>>(new Set())
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set())

  // History — persisted in localStorage
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('brainstorm-history-v2')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [showHistory, setShowHistory] = useState(false)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)

  // Persist history
  useEffect(() => {
    localStorage.setItem('brainstorm-history-v2', JSON.stringify(sessionHistory))
  }, [sessionHistory])

  // Persist selectedAgents to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('brainstorm-selected-agents', JSON.stringify(Array.from(selectedAgents)))
    } catch {
      // Ignore
    }
  }, [selectedAgents])

  // Persist customPrompt to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('brainstorm-custom-prompt', customPrompt)
    } catch {
      // Ignore
    }
  }, [customPrompt])

  // Persist brainstormResult to localStorage
  useEffect(() => {
    try {
      if (brainstormResult) {
        localStorage.setItem('brainstorm-current-result', JSON.stringify(brainstormResult))
      } else {
        localStorage.removeItem('brainstorm-current-result')
      }
    } catch {
      // Ignore
    }
  }, [brainstormResult])

  useEffect(() => {
    fetchIdeas()
  }, [fetchIdeas])

  // Clean up lit interval
  useEffect(() => {
    return () => {
      if (litInterval.current) clearInterval(litInterval.current)
    }
  }, [])

  // ------ Agent selection helpers ------

  const toggleAgent = (agentId: string) => {
    setSelectedAgents((prev) => {
      const next = new Set(prev)
      if (next.has(agentId)) {
        next.delete(agentId)
      } else {
        next.add(agentId)
      }
      return next
    })
  }

  const allSelected = selectedAgents.size === BRAINSTORM_AGENTS.length
  const toggleAll = () => {
    if (allSelected) {
      setSelectedAgents(new Set())
    } else {
      setSelectedAgents(new Set(BRAINSTORM_AGENTS.map((a) => a.id)))
    }
  }

  const getAgentById = (id: string) => BRAINSTORM_AGENTS.find((a) => a.id === id)

  const selectedAgentObjects = useCallback(
    () => BRAINSTORM_AGENTS.filter((a) => selectedAgents.has(a.id)),
    [selectedAgents]
  )

  // ------ Brainstorm ------

  const handleStartBrainstorm = async () => {
    setViewMode('generating')
    setBrainstormResult(null)
    setLitAgentIdx(0)
    setCurrentStage('')
    setKbContextCount(0)

    // Start the sequential light-up animation
    const agentIds = Array.from(selectedAgents)
    let idx = 0
    litInterval.current = setInterval(() => {
      idx = (idx + 1) % agentIds.length
      setLitAgentIdx(idx)
    }, 800)

    try {
      // Step 1: Start async brainstorm
      // 'Any' sends 'all' — backend brainstorm-worker handles 'all' as no category filter
      const startResult = await startBrainstorm({
        category: (category === 'Any' ? 'all' : category) as IdeaCategory,
        prompt: buildPrompt(),
        count: ideaCount,
        agents: Array.from(selectedAgents),
        categoryGroup: ideaType === 'all' ? undefined : ideaType,
        ...(evolveFromIdeaId ? { evolveFromIdeaId } : {}),
      } as any)

      const sessionId = startResult.sessionId

      // Step 2: Poll for results
      let attempts = 0
      const maxAttempts = 60 // 60 * 3s = 3 minutes max
      let sessionData: any = null

      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 3000))
        attempts++

        try {
          const status = await getBrainstormStatus(sessionId)
          // Update progress state for UI
          const s = status as typeof status & { stage?: string; kbContextCount?: number }
          if (s.stage) setCurrentStage(s.stage)
          if (typeof s.kbContextCount === 'number') setKbContextCount(s.kbContextCount)
          if (status.status === 'complete') {
            sessionData = status
            break
          } else if (status.status === 'error') {
            throw new Error(status.error || 'Analysis ended with an error')
          }
          // Still generating — continue polling
        } catch (pollErr) {
          // Ignore transient errors during polling
          if (attempts > 10) throw pollErr
        }
      }

      // Stop animation
      if (litInterval.current) {
        clearInterval(litInterval.current)
        litInterval.current = null
      }

      if (!sessionData) {
        throw new Error('Timeout — analysis is taking too long. Try again with fewer experts.')
      }

      // Normalise API response
      const normalised: BrainstormResult = {
        ideas: (sessionData.ideas || []).map((idea: any) => normaliseIdea(idea)),
        discussion: sessionData.discussion || '',
        agentCount: sessionData.agentCount || selectedAgents.size,
        sessionId: sessionData.sessionId || sessionId,
      }

      setBrainstormResult(normalised)
      setViewMode('results')

      // Save to history
      const session: SessionHistoryItem = {
        id: normalised.sessionId,
        category: category,
        agentCount: selectedAgents.size,
        ideaCount: normalised.ideas.length,
        createdAt: new Date().toISOString(),
        agentIds: Array.from(selectedAgents),
        result: normalised,
      }
      setSessionHistory((prev) => [session, ...prev].slice(0, 50))
    } catch (err) {
      if (litInterval.current) {
        clearInterval(litInterval.current)
        litInterval.current = null
      }
      addToast({ type: 'error', message: `Strategic analysis error: ${(err as Error).message}` })
      setViewMode('config')
    }
  }

  const buildPrompt = (): string => {
    let prompt = ''
    if (category !== 'Any') {
      prompt += `Category: ${category}\n`
    }
    if (ideaType !== 'all') {
      const labels: Record<string, string> = {
        technical: 'Technical',
        business: 'Business',
        sales: 'Sales',
        operations: 'Operations',
      }
      prompt += `Idea type: ${labels[ideaType]}\n`
    }
    if (customPrompt.trim()) {
      prompt += `Additional context: ${customPrompt}\n`
    }
    return prompt
  }

  const normaliseIdea = (idea: any): GeneratedIdea => ({
    name: idea.name || '',
    tagline: idea.tagline || '',
    problem: idea.problem || '',
    solution: idea.solution || '',
    architecture: idea.architecture || '',
    awsServices: idea.awsServices || [],
    complexity: idea.complexity || 'medium',
    mvpTime: idea.mvpTime || '3 months',
    risk: idea.risk || 'medium',
    riskNote: idea.riskNote || '',
    mrr: idea.mrr || '',
    model: idea.model || '',
    selfService: idea.selfService || false,
    potential: idea.potential || 'medium',
    category: idea.category || category,
    categoryGroup: idea.categoryGroup || 'technical',
    categoryType: idea.categoryType || 'technical',
    targetBuyer: idea.targetBuyer || '',
    customerPerspective: idea.customerPerspective || '',
    differentiator: idea.differentiator || '',
    championedBy: idea.championedBy || [],
    challengedBy: idea.challengedBy || [],
    panelNotes: idea.panelNotes || '',
  })

  // ------ Idea actions ------

  const buildIdeaPayload = (idea: GeneratedIdea, extraOrder = 0) => ({
    // Spread the whole generated idea — preserves championedBy, challengedBy,
    // panelNotes, categoryType, categoryGroup, targetBuyer, customerPerspective,
    // differentiator, awsServices, architectureDiagram, sapModules, costEstimate
    ...idea,
    category: (idea.category as IdeaCategory) || 'Cloud & Infrastructure',
    status: 'active' as const,
    order: ideas.length + 1 + extraOrder,
    sourceSessionId: brainstormResult?.sessionId,
  })

  const handleAddIdea = async (idea: GeneratedIdea, idx: number) => {
    const key = `idea-${idx}`
    setAddingIdea(key)
    try {
      await createIdea(buildIdeaPayload(idea))
      addToast({ type: 'success', message: `Added "${idea.name}" to portfolio` })
      fetchIdeas()
    } catch (err) {
      if (err instanceof DuplicateIdeaError) {
        // Surface the dialog instead of a toast — the user gets to decide.
        setDuplicatePrompt({
          idea,
          idx,
          existing: err.existingIdea,
          similarity: err.similarity,
        })
      } else {
        addToast({ type: 'error', message: `Error: ${(err as Error).message}` })
      }
    } finally {
      setAddingIdea(null)
    }
  }

  const handleDuplicateProceed = async () => {
    if (!duplicatePrompt) return
    setForceSaving(true)
    try {
      await createIdea(buildIdeaPayload(duplicatePrompt.idea), true)
      addToast({
        type: 'success',
        message: `Added "${duplicatePrompt.idea.name}" to portfolio`,
      })
      fetchIdeas()
      setDuplicatePrompt(null)
    } catch (err) {
      addToast({ type: 'error', message: `Error: ${(err as Error).message}` })
    } finally {
      setForceSaving(false)
    }
  }

  const handleDuplicateViewExisting = (_ideaId: string) => {
    // Close the dialog and navigate to the portfolio listing. We don't
    // deep-link to a single idea because the list page doesn't have that
    // concept yet — the user lands on the list and can find it manually.
    setDuplicatePrompt(null)
    navigate('/team/ideas')
  }

  const handleRemoveIdea = (idx: number) => {
    if (!brainstormResult) return
    setBrainstormResult({
      ...brainstormResult,
      ideas: brainstormResult.ideas.filter((_, i) => i !== idx),
    })
  }

  const handleAddAll = async () => {
    if (!brainstormResult || addingAll) return
    setAddingAll(true)
    let count = 0
    let skipped = 0
    try {
      for (let i = 0; i < brainstormResult.ideas.length; i++) {
        const idea = brainstormResult.ideas[i]
        try {
          await createIdea(buildIdeaPayload(idea, i))
          count++
        } catch (err) {
          // Silently skip duplicates during bulk add (popping a modal per
          // idea would be awful UX). Report the aggregate count in the
          // toast at the end.
          if (err instanceof DuplicateIdeaError) {
            skipped++
          }
          // Continue adding remaining ideas
        }
      }
      // Fetch ideas once at the end
      await fetchIdeas()
      const suffix = skipped > 0 ? ` (${skipped} skipped as duplicates)` : ''
      addToast({
        type: 'success',
        message: `Added ${count} recommendations to portfolio${suffix}`,
      })
    } catch (err) {
      addToast({ type: 'error', message: `Error: ${(err as Error).message}` })
    } finally {
      setAddingAll(false)
    }
  }

  const handleNewSession = () => {
    setViewMode('config')
    setBrainstormResult(null)
    setExpandedProblems(new Set())
    setExpandedNotes(new Set())
    // Clear persisted result
    try {
      localStorage.removeItem('brainstorm-current-result')
    } catch {
      // Ignore
    }
  }

  const handleExportReport = () => {
    if (!brainstormResult) return
    const lines: string[] = []
    lines.push('STRATEGIC REPORT')
    lines.push('=' .repeat(60))
    lines.push(`Date: ${new Date().toLocaleString('en-US')}`)
    lines.push(`Category: ${category}`)
    lines.push(`Number of experts: ${brainstormResult.agentCount}`)
    lines.push('')
    if (brainstormResult.discussion) {
      lines.push('ADVISORY PANEL SYNTHESIS')
      lines.push('-'.repeat(40))
      lines.push(brainstormResult.discussion)
      lines.push('')
    }
    lines.push('STRATEGIC RECOMMENDATIONS')
    lines.push('-'.repeat(40))
    brainstormResult.ideas.forEach((idea, idx) => {
      lines.push(`\n${idx + 1}. ${idea.name}`)
      lines.push(`   ${idea.tagline}`)
      lines.push(`   Problem: ${idea.problem}`)
      lines.push(`   Solution: ${idea.solution}`)
      lines.push(`   Complexity: ${complexityLabel(idea.complexity)} | MVP: ${idea.mvpTime} | Risk: ${riskLabel(idea.risk)}`)
      if (idea.mrr) lines.push(`   Estimated MRR: ${idea.mrr}`)
      if (idea.targetBuyer) lines.push(`   Target buyer: ${idea.targetBuyer}`)
      if (idea.panelNotes) lines.push(`   Panel notes: ${idea.panelNotes}`)
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `strategic-report-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ------ Helpers ------

  const toggleSet = (set: Set<number>, val: number): Set<number> => {
    const next = new Set(set)
    if (next.has(val)) next.delete(val)
    else next.add(val)
    return next
  }

  const complexityLabel = (c: string) =>
    c === 'low' ? 'Low' : c === 'high' ? 'High' : 'Medium'

  const riskLabel = (r: string) =>
    r === 'low' ? 'Low' : r === 'high' ? 'High' : 'Medium'

  const potentialLabel = (p: string) =>
    p === 'low' ? 'Low' : p === 'high' ? 'High' : 'Medium'

  const categoryTypeLabel = (ct: string) => {
    const map: Record<string, string> = {
      technical: 'Technical',
      business: 'Business',
      sales: 'Sales',
      operations: 'Operations',
    }
    return map[ct] || ct
  }

  const categoryTypeBadgeVariant = (ct: string): 'info' | 'success' | 'warning' | 'danger' => {
    const map: Record<string, 'info' | 'success' | 'warning' | 'danger'> = {
      technical: 'info',
      business: 'success',
      sales: 'warning',
      operations: 'danger',
    }
    return map[ct] || 'info'
  }

  // -----------------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------------

  return (
    <AppShell topNav={<TopNav />} sidebar={<Sidebar />}>
      <div className="p-8 min-h-screen">
        {/* ============ HEADER ============ */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent via-purple to-pink-500 flex items-center justify-center shadow-lg shadow-accent/20">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-3xl text-text">Strategy Session</h1>
              </div>
              <p className="text-text-muted text-sm">
                Interdisciplinary panel of experts analyzes and recommends the best strategic directions
              </p>
            </div>
          </div>
        </div>

        {/* ============ EVOLVE BANNER ============ */}
        {evolveSeed && viewMode === 'config' && (
          <div className="mb-6 p-4 rounded-xl bg-accent/10 border border-accent/30 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-text">Evolving: {evolveSeed.name}</p>
              <p className="text-xs text-text-muted mt-1">
                The panel will generate extensions, adjacent opportunities, and pivots based on this idea.
              </p>
            </div>
            <button
              onClick={() => { window.history.replaceState({}, '', '/team/brainstorm'); window.location.reload() }}
              className="text-xs text-text-muted hover:text-text cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}

        {/* ============ CONFIG VIEW ============ */}
        {viewMode === 'config' && (
          <div className="flex gap-6">
            {/* Left side (65%) */}
            <div className="flex-[65] min-w-0 space-y-6">
              {/* Category selector */}
              <Card>
                <h3 className="text-sm font-semibold text-text mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-accent" />
                  Session Configuration
                </h3>

                {/* Category dropdown */}
                <div className="mb-5">
                  <label className="block text-sm text-text-muted mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as IdeaCategory | 'Any')}
                    className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-colors"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Idea type toggle */}
                <div className="mb-5">
                  <label className="block text-sm text-text-muted mb-1.5">Recommendation Type</label>
                  <div className="flex gap-1 bg-surface-2 rounded-xl p-1">
                    {IDEA_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setIdeaType(opt.value)}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                          ideaType === opt.value
                            ? 'bg-accent text-white shadow-lg shadow-accent/20'
                            : 'text-text-muted hover:text-text hover:bg-surface/50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Number of ideas */}
                <div className="mb-5">
                  <label className="block text-sm text-text-muted mb-1.5">Number of Recommendations</label>
                  <div className="flex gap-3">
                    {IDEA_COUNT_OPTIONS.map((count) => (
                      <button
                        key={count}
                        onClick={() => setIdeaCount(count)}
                        className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer border-2 ${
                          ideaCount === count
                            ? 'border-accent bg-accent/10 text-accent shadow-lg shadow-accent/10'
                            : 'border-border bg-surface-2 text-text-muted hover:border-border-hover hover:text-text'
                        }`}
                      >
                        {count} recommendations
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom prompt */}
                <Textarea
                  label="Additional context for the panel (optional)"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="E.g. Focus on SAP HANA tooling, include GDPR compliance, consider synergies with existing products..."
                  rows={3}
                />
              </Card>

              {/* Start button */}
              <button
                onClick={handleStartBrainstorm}
                disabled={selectedAgents.size < 3}
                className="w-full py-4 rounded-xl text-white font-semibold text-lg transition-all duration-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-accent via-purple to-pink-500 bg-[length:200%_100%] hover:bg-[position:100%_0] shadow-lg shadow-accent/25 hover:shadow-xl hover:shadow-accent/35 flex items-center justify-center gap-3 group"
              >
                <Sparkles className="w-5 h-5 group-hover:animate-pulse" />
                Start Strategic Analysis
                {selectedAgents.size < 3 && (
                  <span className="text-sm font-normal opacity-75 ml-2">
                    (all 3 experts required)
                  </span>
                )}
              </button>
              <p className="text-xs text-text-muted text-center mt-3">
                The panel will consult the Knowledge Base to avoid duplicating existing portfolio ideas.
              </p>

              {/* History section */}
              {sessionHistory.length > 0 && (
                <Card>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center justify-between w-full cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-text-muted" />
                      <h3 className="text-sm font-semibold text-text">
                        Strategy Session History ({sessionHistory.length})
                      </h3>
                    </div>
                    {showHistory ? (
                      <ChevronUp className="w-4 h-4 text-text-muted" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-text-muted" />
                    )}
                  </button>

                  {showHistory && (
                    <div className="mt-4 space-y-2">
                      {sessionHistory.map((session) => (
                        <div
                          key={session.id}
                          className="bg-surface-2 rounded-lg border border-border"
                        >
                          <button
                            onClick={() =>
                              setExpandedSession(
                                expandedSession === session.id ? null : session.id
                              )
                            }
                            className="w-full p-3 flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <Clock className="w-4 h-4 text-text-muted" />
                              <span className="text-sm text-text">
                                {new Date(session.createdAt).toLocaleString('en-US')}
                              </span>
                              <Badge variant="info">{session.category}</Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-text-muted">
                              <span>{session.agentCount} experts</span>
                              <span>{session.ideaCount} recommendations</span>
                              {expandedSession === session.id ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </div>
                          </button>

                          {expandedSession === session.id && session.result && (
                            <div className="px-3 pb-3 space-y-2">
                              {session.result.discussion && (
                                <div className="p-2 bg-surface rounded-lg text-xs text-text-muted italic border-l-2 border-accent/40">
                                  {session.result.discussion}
                                </div>
                              )}
                              {session.result.ideas.map((idea, idx) => (
                                <div
                                  key={idx}
                                  className="p-2 bg-surface rounded-lg flex items-center gap-2"
                                >
                                  <span className="text-xs font-bold text-accent">
                                    #{idx + 1}
                                  </span>
                                  <span className="text-sm text-text">{idea.name}</span>
                                  <span className="text-xs text-text-muted italic ml-auto">
                                    {idea.tagline}
                                  </span>
                                </div>
                              ))}
                              {/* Show participating agents */}
                              <div className="flex items-center gap-1 pt-2">
                                {session.agentIds.map((aid) => {
                                  const ag = getAgentById(aid)
                                  return ag ? (
                                    <div
                                      key={aid}
                                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-semibold"
                                      style={{ backgroundColor: ag.color }}
                                      title={ag.name}
                                    >
                                      {ag.avatar}
                                    </div>
                                  ) : null
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </div>

            {/* Right side (35%) — Agent panel */}
            <div className="flex-[35] min-w-0">
              <Card className="sticky top-24">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                    <Users className="w-4 h-4 text-accent" />
                    Advisory Panel
                  </h3>
                  <Badge variant="info" size="md">
                    {selectedAgents.size}/12 selected
                  </Badge>
                </div>

                {/* Toggle all */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-text-muted">Select a minimum of 3 experts</p>
                  <button
                    onClick={toggleAll}
                    className="text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer underline underline-offset-2"
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {/* Agent groups */}
                <div className="space-y-4">
                  {AGENT_GROUPS.map((group) => (
                    <div key={group.label}>
                      <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                        {group.label}
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        {group.ids.map((agentId) => {
                          const agent = getAgentById(agentId)
                          if (!agent) return null
                          const isSelected = selectedAgents.has(agent.id)
                          return (
                            <button
                              key={agent.id}
                              onClick={() => toggleAgent(agent.id)}
                              className={`relative p-2 rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                                isSelected
                                  ? 'border-transparent'
                                  : 'border-border hover:border-border-hover bg-surface-2'
                              }`}
                              style={
                                isSelected
                                  ? {
                                      borderColor: agent.color + '60',
                                      boxShadow: `0 0 16px ${agent.color}20, 0 0 4px ${agent.color}30`,
                                      background: `linear-gradient(135deg, ${agent.color}15, transparent)`,
                                    }
                                  : undefined
                              }
                              title={agent.role}
                            >
                              {isSelected && (
                                <div
                                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                                  style={{ backgroundColor: agent.color }}
                                >
                                  <Check className="w-2.5 h-2.5 text-white" />
                                </div>
                              )}
                              <div className="flex justify-center mb-1.5">
                                <div
                                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                                  style={{ backgroundColor: agent.color }}
                                >
                                  {agent.avatar}
                                </div>
                              </div>
                              <p className="text-[10px] font-semibold text-text leading-tight truncate">
                                {agent.name}
                              </p>
                              <p className="text-[9px] text-text-muted leading-tight truncate mt-0.5">
                                {agent.role.length > 24
                                  ? agent.role.slice(0, 22) + '...'
                                  : agent.role}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ============ GENERATING VIEW ============ */}
        {viewMode === 'generating' && (
          <div className="flex flex-col items-center justify-center py-20">
            {/* Spinner */}
            <div className="relative mb-8">
              <div className="w-20 h-20 rounded-full border-4 border-surface-2 border-t-accent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Brain className="w-8 h-8 text-accent" />
              </div>
            </div>

            <h2 className="font-display text-2xl text-text mb-2">
              Strategic analysis in progress
              <span className="inline-flex ml-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '200ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '400ms' }}>.</span>
              </span>
            </h2>

            {/* Agent avatars row */}
            <div className="flex items-center gap-3 my-8">
              {selectedAgentObjects().map((agent, idx) => {
                const isLit = idx === litAgentIdx
                return (
                  <div
                    key={agent.id}
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-500 ${
                      isLit ? 'scale-125 shadow-lg text-white' : 'opacity-40 scale-100 text-white/70'
                    }`}
                    style={{
                      backgroundColor: isLit ? agent.color : agent.color + '60',
                      boxShadow: isLit ? `0 0 20px ${agent.color}50` : 'none',
                    }}
                  >
                    {agent.avatar}
                  </div>
                )
              })}
            </div>

            <p className="text-text-muted text-sm text-center max-w-md">
              Experts are analyzing market data, evaluating technical feasibility, and preparing{' '}
              <span className="text-accent font-semibold">{ideaCount}</span> recommendations...
            </p>

            {/* Stage indicator */}
            {currentStage && (
              <div className="mt-6 flex items-center gap-2 text-xs">
                <span className="text-text-muted">Stage:</span>
                <span className={`px-2 py-0.5 rounded-lg font-medium ${currentStage === 'diverge' ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-text-muted'}`}>
                  Diverge
                </span>
                <span className="text-text-muted/30">→</span>
                <span className={`px-2 py-0.5 rounded-lg font-medium ${currentStage === 'critique' ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-text-muted'}`}>
                  Critique
                </span>
                <span className="text-text-muted/30">→</span>
                <span className={`px-2 py-0.5 rounded-lg font-medium ${currentStage === 'converge' ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-text-muted'}`}>
                  Converge
                </span>
              </div>
            )}

            {/* KB-awareness indicator */}
            {kbContextCount > 0 && (
              <p className="text-accent/70 text-xs mt-3 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" />
                Panel is consulting {kbContextCount} existing {kbContextCount === 1 ? 'idea' : 'ideas'} from the Knowledge Base
              </p>
            )}

            <p className="text-text-muted/50 text-xs mt-4">
              Estimated time: 60-90 seconds
            </p>
          </div>
        )}

        {/* ============ RESULTS VIEW ============ */}
        {viewMode === 'results' && brainstormResult && (
          <div className="space-y-6">
            {/* Results header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-display text-text">Strategic Recommendations</h2>
                <div className="flex items-center gap-3 mt-1">
                  <Badge variant="accent" size="md">
                    {brainstormResult.ideas.length} recommendations from{' '}
                    {brainstormResult.agentCount} experts
                  </Badge>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleNewSession}>
                  New Strategy Session
                </Button>
                <Button
                  variant="secondary"
                  icon={<Download className="w-4 h-4" />}
                  onClick={handleExportReport}
                >
                  Export Report
                </Button>
                <Button
                  variant="primary"
                  icon={addingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  onClick={handleAddAll}
                  disabled={addingAll}
                >
                  {addingAll ? 'Adding...' : 'Add All to Portfolio'}
                </Button>
              </div>
            </div>

            {/* Discussion summary */}
            {brainstormResult.discussion && (
              <div className="relative bg-surface/40 backdrop-blur-xl border border-border rounded-2xl p-6 border-l-4 border-l-accent/60">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-accent" />
                  <h3 className="text-sm font-semibold text-text">Advisory Panel Synthesis</h3>
                </div>
                <p className="text-sm text-text-muted leading-relaxed">
                  {brainstormResult.discussion}
                </p>
              </div>
            )}

            {/* Ideas grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {brainstormResult.ideas.map((idea, idx) => {
                const key = `idea-${idx}`
                const isProblemExpanded = expandedProblems.has(idx)
                const isNotesExpanded = expandedNotes.has(idx)

                return (
                  <Card key={idx} className="relative overflow-hidden">
                    {/* Number badge */}
                    <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
                      <span className="text-xs font-bold text-accent">#{idx + 1}</span>
                    </div>

                    <div className="pr-10">
                      {/* Category badges */}
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <Badge variant="info" size="sm">
                          {idea.category}
                        </Badge>
                        <Badge variant={categoryTypeBadgeVariant(idea.categoryType)} size="sm">
                          {categoryTypeLabel(idea.categoryType)}
                        </Badge>
                      </div>

                      {/* Name & tagline */}
                      <h3 className="font-display text-lg text-text mb-1">{idea.name}</h3>
                      <p className="text-sm text-accent italic mb-3">{idea.tagline}</p>

                      {/* Problem (truncated / expandable) */}
                      <div className="mb-3">
                        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                          Problem
                        </h4>
                        <p
                          className={`text-xs text-text-muted ${
                            !isProblemExpanded ? 'line-clamp-2' : ''
                          }`}
                        >
                          {idea.problem}
                        </p>
                        {idea.problem && idea.problem.length > 120 && (
                          <button
                            onClick={() =>
                              setExpandedProblems(toggleSet(expandedProblems, idx))
                            }
                            className="text-[10px] text-accent mt-0.5 cursor-pointer hover:underline"
                          >
                            {isProblemExpanded ? 'Collapse' : 'Expand'}
                          </button>
                        )}
                      </div>

                      {/* Solution */}
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                          Solution
                        </h4>
                        <p className="text-xs text-text-muted">{idea.solution}</p>
                      </div>

                      {/* Quick stats row */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="text-[11px] px-2 py-1 rounded-lg bg-surface-2 text-text-muted flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {complexityLabel(idea.complexity)}
                        </span>
                        {idea.mvpTime && (
                          <span className="text-[11px] px-2 py-1 rounded-lg bg-surface-2 text-text-muted flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {idea.mvpTime}
                          </span>
                        )}
                        <span className="text-[11px] px-2 py-1 rounded-lg bg-surface-2 text-text-muted flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Risk: {riskLabel(idea.risk)}
                        </span>
                        {idea.mrr && (
                          <span className="text-[11px] px-2 py-1 rounded-lg bg-surface-2 text-text-muted flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            MRR: {idea.mrr}
                          </span>
                        )}
                        <span className="text-[11px] px-2 py-1 rounded-lg bg-surface-2 text-text-muted flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          Potential: {potentialLabel(idea.potential)}
                        </span>
                      </div>

                      {/* Recommended by / Concerns from */}
                      <div className="flex flex-wrap gap-4 mb-3">
                        {idea.championedBy && idea.championedBy.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-text-muted font-medium">Championed by:</span>
                            <div className="flex -space-x-1">
                              {idea.championedBy.map((aid) => {
                                const ag = getAgentById(aid)
                                return ag ? (
                                  <div
                                    key={aid}
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-semibold text-white border-2 border-surface"
                                    style={{ backgroundColor: ag.color }}
                                    title={ag.name}
                                  >
                                    {ag.avatar}
                                  </div>
                                ) : null
                              })}
                            </div>
                          </div>
                        )}
                        {idea.challengedBy && idea.challengedBy.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-danger font-medium">Concerns raised by:</span>
                            <div className="flex -space-x-1">
                              {idea.challengedBy.map((aid) => {
                                const ag = getAgentById(aid)
                                return ag ? (
                                  <div
                                    key={aid}
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-semibold text-white border-2 border-danger/30"
                                    style={{ backgroundColor: ag.color }}
                                    title={ag.name}
                                  >
                                    {ag.avatar}
                                  </div>
                                ) : null
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Panel notes (expandable) */}
                      {idea.panelNotes && (
                        <div className="mb-4">
                          <button
                            onClick={() => setExpandedNotes(toggleSet(expandedNotes, idx))}
                            className="flex items-center gap-1 text-[11px] text-accent cursor-pointer hover:underline"
                          >
                            <MessageSquare className="w-3 h-3" />
                            Panel notes
                            {isNotesExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                          {isNotesExpanded && (
                            <div className="mt-2 p-3 bg-surface-2 rounded-lg border-l-2 border-accent/30">
                              <p className="text-xs text-text-muted">{idea.panelNotes}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* AWS services pills */}
                      {idea.awsServices && idea.awsServices.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {idea.awsServices.map((svc) => (
                            <span
                              key={svc}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium"
                            >
                              {svc}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Target buyer */}
                      {idea.targetBuyer && (
                        <div className="mb-4">
                          <span className="text-[10px] text-text-muted font-medium">Target buyer: </span>
                          <span className="text-[10px] text-text">{idea.targetBuyer}</span>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-3 border-t border-border">
                        <button
                          disabled={addingIdea === key}
                          onClick={() => handleAddIdea(idea, idx)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-success bg-success/10 hover:bg-success/20 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {addingIdea === key ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          Add to Portfolio
                        </button>
                        <button
                          onClick={() => handleRemoveIdea(idx)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-danger bg-danger/10 hover:bg-danger/20 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>

            {/* Empty state */}
            {brainstormResult.ideas.length === 0 && (
              <div className="text-center py-12 text-text-muted">
                <p>All recommendations have been rejected or added to the portfolio.</p>
                <Button variant="secondary" className="mt-4" onClick={handleNewSession}>
                  Start a new strategy session
                </Button>
              </div>
            )}

            {/* Bottom actions */}
            {brainstormResult.ideas.length > 0 && (
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <Button variant="secondary" onClick={handleNewSession}>
                  New Strategy Session
                </Button>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    icon={<Download className="w-4 h-4" />}
                    onClick={handleExportReport}
                  >
                    Export Report
                  </Button>
                  <Button
                    variant="primary"
                    icon={addingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    onClick={handleAddAll}
                    disabled={addingAll}
                  >
                    {addingAll ? 'Adding...' : 'Add All to Portfolio'}
                  </Button>
                </div>
              </div>
            )}

            {/* History at bottom of results */}
            {sessionHistory.length > 1 && (
              <Card className="mt-6">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center justify-between w-full cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-text-muted" />
                    <h3 className="text-sm font-semibold text-text">
                      Strategy Session History ({sessionHistory.length - 1})
                    </h3>
                  </div>
                  {showHistory ? (
                    <ChevronUp className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  )}
                </button>

                {showHistory && (
                  <div className="mt-4 space-y-2">
                    {sessionHistory.slice(1).map((session) => (
                      <div
                        key={session.id}
                        className="bg-surface-2 rounded-lg border border-border"
                      >
                        <button
                          onClick={() =>
                            setExpandedSession(
                              expandedSession === session.id ? null : session.id
                            )
                          }
                          className="w-full p-3 flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <Clock className="w-4 h-4 text-text-muted" />
                            <span className="text-sm text-text">
                              {new Date(session.createdAt).toLocaleString('en-US')}
                            </span>
                            <Badge variant="info">{session.category}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-text-muted">
                            <span>{session.agentCount} experts</span>
                            <span>{session.ideaCount} recommendations</span>
                            {expandedSession === session.id ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </div>
                        </button>

                        {expandedSession === session.id && session.result && (
                          <div className="px-3 pb-3 space-y-1">
                            {session.result.ideas.map((idea, iIdx) => (
                              <div
                                key={iIdx}
                                className="p-2 bg-surface rounded-lg flex items-center gap-2"
                              >
                                <span className="text-xs font-bold text-accent">
                                  #{iIdx + 1}
                                </span>
                                <span className="text-sm text-text">{idea.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Duplicate-idea warning dialog. Rendered at the shell level so it
          layers above the results grid when a 409 comes back. */}
      {duplicatePrompt && (
        <DuplicateWarningDialog
          isOpen
          onClose={() => {
            if (forceSaving) return
            setDuplicatePrompt(null)
          }}
          existingIdea={duplicatePrompt.existing}
          similarity={duplicatePrompt.similarity}
          onProceed={handleDuplicateProceed}
          onViewExisting={handleDuplicateViewExisting}
          saving={forceSaving}
        />
      )}
    </AppShell>
  )
}

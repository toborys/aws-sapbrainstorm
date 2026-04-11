import { useState, useEffect, useCallback, useRef } from 'react'
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
import { startBrainstorm, getBrainstormStatus, createIdea } from '../../api/client'
import { BRAINSTORM_AGENTS } from '../../config/agents'
import type { GeneratedIdea } from '../../types/agents'
import type { IdeaCategory } from '../../types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES: (IdeaCategory | 'Dowolna')[] = [
  'Dowolna',
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
  { value: 'all', label: 'Wszystkie' },
  { value: 'technical', label: 'Techniczne' },
  { value: 'business', label: 'Biznesowe' },
  { value: 'sales', label: 'Sprzedazowe' },
  { value: 'operations', label: 'Operacyjne' },
]

const IDEA_COUNT_OPTIONS = [3, 5, 10] as const

type ViewMode = 'config' | 'generating' | 'results'

// Agent group labels
const AGENT_GROUPS: { label: string; ids: string[] }[] = [
  {
    label: 'Strategia & Biznes',
    ids: ['ceo-visionary', 'head-of-sales', 'product-strategist', 'devils-advocate'],
  },
  {
    label: 'Technologia',
    ids: ['sap-architect', 'aws-architect', 'infra-expert', 'genai-aws', 'ai-onprem'],
  },
  {
    label: 'Klient & Rynek',
    ids: ['sap-customer', 'security-expert', 'growth-hacker'],
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

  // Agent selection — persisted to localStorage
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('brainstorm-selected-agents')
      if (saved) {
        const arr = JSON.parse(saved) as string[]
        if (Array.isArray(arr) && arr.length > 0) return new Set(arr)
      }
    } catch {
      // Ignore
    }
    return new Set(['sap-architect', 'product-strategist', 'sap-customer'])
  })

  // Config
  const [category, setCategory] = useState<IdeaCategory | 'Dowolna'>('Dowolna')
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

    // Start the sequential light-up animation
    const agentIds = Array.from(selectedAgents)
    let idx = 0
    litInterval.current = setInterval(() => {
      idx = (idx + 1) % agentIds.length
      setLitAgentIdx(idx)
    }, 800)

    try {
      // Step 1: Start async brainstorm
      const startResult = await startBrainstorm({
        category: category === 'Dowolna' ? ('Cloud & Infrastructure' as IdeaCategory) : (category as IdeaCategory),
        prompt: buildPrompt(),
        count: ideaCount,
        agents: Array.from(selectedAgents),
        categoryGroup: ideaType === 'all' ? undefined : ideaType,
      })

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
          if (status.status === 'complete') {
            sessionData = status
            break
          } else if (status.status === 'error') {
            throw new Error(status.error || 'Analiza zakonczona bledem')
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
        throw new Error('Timeout — analiza trwa zbyt dlugo. Sprobuj ponownie z mniejsza liczba ekspertow.')
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
      addToast({ type: 'error', message: `Blad analizy strategicznej: ${(err as Error).message}` })
      setViewMode('config')
    }
  }

  const buildPrompt = (): string => {
    let prompt = ''
    if (category !== 'Dowolna') {
      prompt += `Kategoria: ${category}\n`
    }
    if (ideaType !== 'all') {
      const labels: Record<string, string> = {
        technical: 'Techniczne',
        business: 'Biznesowe',
        sales: 'Sprzedazowe',
        operations: 'Operacyjne',
      }
      prompt += `Typ pomyslow: ${labels[ideaType]}\n`
    }
    if (customPrompt.trim()) {
      prompt += `Dodatkowy kontekst: ${customPrompt}\n`
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
    mvpTime: idea.mvpTime || '3 miesiace',
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

  const handleAddIdea = async (idea: GeneratedIdea, idx: number) => {
    const key = `idea-${idx}`
    setAddingIdea(key)
    try {
      await createIdea({
        name: idea.name,
        tagline: idea.tagline,
        problem: idea.problem,
        solution: idea.solution,
        architecture: idea.architecture,
        complexity: idea.complexity,
        mvpTime: idea.mvpTime,
        risk: idea.risk,
        riskNote: idea.riskNote,
        mrr: idea.mrr,
        model: idea.model,
        selfService: idea.selfService,
        potential: idea.potential,
        category: (idea.category as IdeaCategory) || 'Cloud & Infrastructure',
        status: 'active',
        order: ideas.length + 1,
      })
      addToast({ type: 'success', message: `Dodano "${idea.name}" do portfolio` })
      fetchIdeas()
    } catch (err) {
      addToast({ type: 'error', message: `Blad: ${(err as Error).message}` })
    } finally {
      setAddingIdea(null)
    }
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
    try {
      for (let i = 0; i < brainstormResult.ideas.length; i++) {
        const idea = brainstormResult.ideas[i]
        try {
          await createIdea({
            name: idea.name,
            tagline: idea.tagline,
            problem: idea.problem,
            solution: idea.solution,
            architecture: idea.architecture,
            complexity: idea.complexity,
            mvpTime: idea.mvpTime,
            risk: idea.risk,
            riskNote: idea.riskNote,
            mrr: idea.mrr,
            model: idea.model,
            selfService: idea.selfService,
            potential: idea.potential,
            category: (idea.category as IdeaCategory) || 'Cloud & Infrastructure',
            status: 'active',
            order: ideas.length + i + 1,
          })
          count++
        } catch {
          // Continue adding remaining ideas
        }
      }
      // Fetch ideas once at the end
      await fetchIdeas()
      addToast({ type: 'success', message: `Dodano ${count} rekomendacji do portfolio` })
    } catch (err) {
      addToast({ type: 'error', message: `Blad: ${(err as Error).message}` })
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
    lines.push('RAPORT STRATEGICZNY')
    lines.push('=' .repeat(60))
    lines.push(`Data: ${new Date().toLocaleString('pl-PL')}`)
    lines.push(`Kategoria: ${category}`)
    lines.push(`Liczba ekspertow: ${brainstormResult.agentCount}`)
    lines.push('')
    if (brainstormResult.discussion) {
      lines.push('SYNTEZA PANELU DORADCZEGO')
      lines.push('-'.repeat(40))
      lines.push(brainstormResult.discussion)
      lines.push('')
    }
    lines.push('REKOMENDACJE STRATEGICZNE')
    lines.push('-'.repeat(40))
    brainstormResult.ideas.forEach((idea, idx) => {
      lines.push(`\n${idx + 1}. ${idea.name}`)
      lines.push(`   ${idea.tagline}`)
      lines.push(`   Problem: ${idea.problem}`)
      lines.push(`   Rozwiazanie: ${idea.solution}`)
      lines.push(`   Zlozonosc: ${complexityLabel(idea.complexity)} | MVP: ${idea.mvpTime} | Ryzyko: ${riskLabel(idea.risk)}`)
      if (idea.mrr) lines.push(`   Szacowane MRR: ${idea.mrr}`)
      if (idea.targetBuyer) lines.push(`   Docelowy nabywca: ${idea.targetBuyer}`)
      if (idea.panelNotes) lines.push(`   Notatki panelu: ${idea.panelNotes}`)
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `raport-strategiczny-${new Date().toISOString().slice(0, 10)}.txt`
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
    c === 'low' ? 'Niska' : c === 'high' ? 'Wysoka' : 'Srednia'

  const riskLabel = (r: string) =>
    r === 'low' ? 'Niskie' : r === 'high' ? 'Wysokie' : 'Srednie'

  const potentialLabel = (p: string) =>
    p === 'low' ? 'Niski' : p === 'high' ? 'Wysoki' : 'Sredni'

  const categoryTypeLabel = (ct: string) => {
    const map: Record<string, string> = {
      technical: 'Techniczny',
      business: 'Biznesowy',
      sales: 'Sprzedazowy',
      operations: 'Operacyjny',
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
                <h1 className="font-display text-3xl text-text">Sesja Strategiczna</h1>
              </div>
              <p className="text-text-muted text-sm">
                Interdyscyplinarny panel ekspertow analizuje i rekomenduje najlepsze kierunki rozwoju
              </p>
            </div>
          </div>
        </div>

        {/* ============ CONFIG VIEW ============ */}
        {viewMode === 'config' && (
          <div className="flex gap-6">
            {/* Left side (65%) */}
            <div className="flex-[65] min-w-0 space-y-6">
              {/* Category selector */}
              <Card>
                <h3 className="text-sm font-semibold text-text mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-accent" />
                  Konfiguracja sesji
                </h3>

                {/* Category dropdown */}
                <div className="mb-5">
                  <label className="block text-sm text-text-muted mb-1.5">Kategoria</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as IdeaCategory | 'Dowolna')}
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
                  <label className="block text-sm text-text-muted mb-1.5">Typ rekomendacji</label>
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
                  <label className="block text-sm text-text-muted mb-1.5">Liczba rekomendacji</label>
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
                        {count} {count === 3 ? 'rekomendacje' : 'rekomendacji'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom prompt */}
                <Textarea
                  label="Dodatkowy kontekst dla panelu (opcjonalny)"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Np. Skup sie na narzediach dla SAP HANA, uwzglednij compliance GDPR, rozwazycie synergje z istniejacymi produktami..."
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
                Rozpocznij analize strategiczna
                {selectedAgents.size < 3 && (
                  <span className="text-sm font-normal opacity-75 ml-2">
                    (min. 3 ekspertow)
                  </span>
                )}
              </button>

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
                        Historia sesji strategicznych ({sessionHistory.length})
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
                                {new Date(session.createdAt).toLocaleString('pl-PL')}
                              </span>
                              <Badge variant="info">{session.category}</Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-text-muted">
                              <span>{session.agentCount} ekspertow</span>
                              <span>{session.ideaCount} rekomendacji</span>
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
                    Panel Doradczy
                  </h3>
                  <Badge variant="info" size="md">
                    {selectedAgents.size}/12 wybranych
                  </Badge>
                </div>

                {/* Toggle all */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-text-muted">Wybierz minimum 3 ekspertow</p>
                  <button
                    onClick={toggleAll}
                    className="text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer underline underline-offset-2"
                  >
                    {allSelected ? 'Odznacz' : 'Zaznacz wszystkich'}
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
              Trwa analiza strategiczna
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
              Eksperci analizuja dane rynkowe, oceniaja wykonalnosc techniczna i przygotowuja{' '}
              <span className="text-accent font-semibold">{ideaCount}</span> rekomendacji...
            </p>

            <p className="text-text-muted/50 text-xs mt-4">
              Szacowany czas: 15-30 sekund
            </p>
          </div>
        )}

        {/* ============ RESULTS VIEW ============ */}
        {viewMode === 'results' && brainstormResult && (
          <div className="space-y-6">
            {/* Results header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-display text-text">Rekomendacje strategiczne</h2>
                <div className="flex items-center gap-3 mt-1">
                  <Badge variant="accent" size="md">
                    {brainstormResult.ideas.length} rekomendacji od{' '}
                    {brainstormResult.agentCount} ekspertow
                  </Badge>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleNewSession}>
                  Nowa sesja strategiczna
                </Button>
                <Button
                  variant="secondary"
                  icon={<Download className="w-4 h-4" />}
                  onClick={handleExportReport}
                >
                  Eksportuj raport
                </Button>
                <Button
                  variant="primary"
                  icon={addingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  onClick={handleAddAll}
                  disabled={addingAll}
                >
                  {addingAll ? 'Dodawanie...' : 'Dodaj wszystkie do portfolio'}
                </Button>
              </div>
            </div>

            {/* Discussion summary */}
            {brainstormResult.discussion && (
              <div className="relative bg-surface/40 backdrop-blur-xl border border-border rounded-2xl p-6 border-l-4 border-l-accent/60">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-accent" />
                  <h3 className="text-sm font-semibold text-text">Synteza panelu doradczego</h3>
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
                            {isProblemExpanded ? 'Zwiern' : 'Rozwin'}
                          </button>
                        )}
                      </div>

                      {/* Solution */}
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                          Rozwiazanie
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
                          Ryzyko: {riskLabel(idea.risk)}
                        </span>
                        {idea.mrr && (
                          <span className="text-[11px] px-2 py-1 rounded-lg bg-surface-2 text-text-muted flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            MRR: {idea.mrr}
                          </span>
                        )}
                        <span className="text-[11px] px-2 py-1 rounded-lg bg-surface-2 text-text-muted flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          Potencjal: {potentialLabel(idea.potential)}
                        </span>
                      </div>

                      {/* Recommended by / Concerns from */}
                      <div className="flex flex-wrap gap-4 mb-3">
                        {idea.championedBy && idea.championedBy.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-text-muted font-medium">Rekomendowane przez:</span>
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
                            <span className="text-[10px] text-danger font-medium">Zastrzezenia:</span>
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
                            Notatki panelu
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
                          <span className="text-[10px] text-text-muted font-medium">Docelowy nabywca: </span>
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
                          Dodaj do portfolio
                        </button>
                        <button
                          onClick={() => handleRemoveIdea(idx)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-danger bg-danger/10 hover:bg-danger/20 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          Odrzuc
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
                <p>Wszystkie rekomendacje zostaly odrzucone lub dodane do portfolio.</p>
                <Button variant="secondary" className="mt-4" onClick={handleNewSession}>
                  Rozpocznij nowa sesje strategiczna
                </Button>
              </div>
            )}

            {/* Bottom actions */}
            {brainstormResult.ideas.length > 0 && (
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <Button variant="secondary" onClick={handleNewSession}>
                  Nowa sesja strategiczna
                </Button>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    icon={<Download className="w-4 h-4" />}
                    onClick={handleExportReport}
                  >
                    Eksportuj raport
                  </Button>
                  <Button
                    variant="primary"
                    icon={addingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    onClick={handleAddAll}
                    disabled={addingAll}
                  >
                    {addingAll ? 'Dodawanie...' : 'Dodaj wszystkie do portfolio'}
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
                      Historia sesji strategicznych ({sessionHistory.length - 1})
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
                              {new Date(session.createdAt).toLocaleString('pl-PL')}
                            </span>
                            <Badge variant="info">{session.category}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-text-muted">
                            <span>{session.agentCount} ekspertow</span>
                            <span>{session.ideaCount} rekomendacji</span>
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
    </AppShell>
  )
}

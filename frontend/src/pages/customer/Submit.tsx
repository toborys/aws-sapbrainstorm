import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles, X, GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AppShell } from '../../components/layout/AppShell'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { useIdeasStore } from '../../stores/ideasStore'
import { useVotesStore } from '../../stores/votesStore'
import { useUiStore } from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'

const CUSTOM_IDEA_KEY = 'apx-custom-idea-draft'
const RANKING_KEY = 'apx-ranking-draft'
const WTP_KEY = 'apx-wtp-draft'
const URGENCY_KEY = 'apx-urgency-draft'
const PILOT_OPTIN_KEY = 'apx-pilot-optin-draft'
const PILOT_EMAIL_KEY = 'apx-pilot-email-draft'

type WtpBand = 'lt-100' | '100-300' | '300-800' | '800-2000' | 'gt-2000' | 'wont-pay'
type Urgency = '0-3m' | '3-12m' | '12m-plus' | 'not-sure'

const WTP_OPTIONS: { value: WtpBand; label: string }[] = [
  { value: 'wont-pay', label: 'Would not pay' },
  { value: 'lt-100', label: '< EUR 100/mo' },
  { value: '100-300', label: 'EUR 100-300/mo' },
  { value: '300-800', label: 'EUR 300-800/mo' },
  { value: '800-2000', label: 'EUR 800-2000/mo' },
  { value: 'gt-2000', label: '> EUR 2000/mo' },
]

const URGENCY_OPTIONS: { value: Urgency; label: string }[] = [
  { value: '0-3m', label: 'Need in 0-3 months' },
  { value: '3-12m', label: '3-12 months' },
  { value: '12m-plus', label: '12 months+' },
  { value: 'not-sure', label: 'Not sure' },
]

function SortableRankRow({
  id,
  index,
  name,
  category,
}: {
  id: string
  index: number
  name: string
  category: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-surface-2 rounded-lg border border-border"
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-text-muted hover:text-text cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="text-accent font-mono text-sm w-6 shrink-0">{index + 1}.</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">{name}</span>
          <Badge variant="info" className="hidden sm:inline-flex">
            {category}
          </Badge>
        </div>
      </div>
    </div>
  )
}

export default function CustomerSubmit() {
  const navigate = useNavigate()
  const { ideas, selectedIds, toggleSelect } = useIdeasStore()
  const { submitting, submitVotes } = useVotesStore()
  const addToast = useUiStore((s) => s.addToast)
  const user = useAuthStore((s) => s.user)

  const [customIdea, setCustomIdea] = useState(() => {
    try {
      return sessionStorage.getItem(CUSTOM_IDEA_KEY) || ''
    } catch {
      return ''
    }
  })
  const [consent, setConsent] = useState(false)

  // Ranking: ordered idea IDs. Initialized from persisted ranking (filtered to selectedIds) or selectedIds order.
  const [ranking, setRanking] = useState<string[]>(() => {
    try {
      const stored = sessionStorage.getItem(RANKING_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        if (Array.isArray(parsed)) return parsed
      }
    } catch {
      // Ignore
    }
    return []
  })

  const [wtpBand, setWtpBand] = useState<WtpBand | ''>(() => {
    try {
      return (sessionStorage.getItem(WTP_KEY) as WtpBand) || ''
    } catch {
      return ''
    }
  })
  const [urgency, setUrgency] = useState<Urgency | ''>(() => {
    try {
      return (sessionStorage.getItem(URGENCY_KEY) as Urgency) || ''
    } catch {
      return ''
    }
  })
  const [pilotOptIn, setPilotOptIn] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(PILOT_OPTIN_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [pilotEmail, setPilotEmail] = useState<string>(() => {
    try {
      const stored = sessionStorage.getItem(PILOT_EMAIL_KEY)
      if (stored) return stored
    } catch {
      // Ignore
    }
    return user?.email || ''
  })

  const charCount = customIdea.length
  const maxChars = 1000

  // Keep ranking in sync with selectedIds (add newly-selected at the bottom, drop removed)
  useEffect(() => {
    setRanking((prev) => {
      const selSet = new Set(selectedIds)
      const kept = prev.filter((id) => selSet.has(id))
      const appended = selectedIds.filter((id) => !kept.includes(id))
      const next = [...kept, ...appended]
      // Only update state if actually different, to avoid render loops
      if (next.length === prev.length && next.every((v, i) => v === prev[i])) return prev
      return next
    })
  }, [selectedIds])

  // Persist drafts
  useEffect(() => {
    try {
      sessionStorage.setItem(CUSTOM_IDEA_KEY, customIdea)
    } catch {
      // Ignore
    }
  }, [customIdea])
  useEffect(() => {
    try {
      sessionStorage.setItem(RANKING_KEY, JSON.stringify(ranking))
    } catch {
      // Ignore
    }
  }, [ranking])
  useEffect(() => {
    try {
      sessionStorage.setItem(WTP_KEY, wtpBand)
    } catch {
      // Ignore
    }
  }, [wtpBand])
  useEffect(() => {
    try {
      sessionStorage.setItem(URGENCY_KEY, urgency)
    } catch {
      // Ignore
    }
  }, [urgency])
  useEffect(() => {
    try {
      sessionStorage.setItem(PILOT_OPTIN_KEY, pilotOptIn ? 'true' : 'false')
    } catch {
      // Ignore
    }
  }, [pilotOptIn])
  useEffect(() => {
    try {
      sessionStorage.setItem(PILOT_EMAIL_KEY, pilotEmail)
    } catch {
      // Ignore
    }
  }, [pilotEmail])

  const selectedIdeas = useMemo(
    () => ideas.filter((i) => selectedIds.includes(i.id)),
    [ideas, selectedIds],
  )

  const rankedIdeas = useMemo(
    () =>
      ranking
        .map((id) => ideas.find((i) => i.id === id))
        .filter((x): x is NonNullable<typeof x> => !!x),
    [ranking, ideas],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ranking.indexOf(String(active.id))
    const newIndex = ranking.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    setRanking(arrayMove(ranking, oldIndex, newIndex))
  }

  const pilotEmailValid =
    !pilotOptIn ||
    (pilotEmail.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pilotEmail.trim()))

  const canSubmit =
    consent &&
    selectedIdeas.length > 0 &&
    !submitting &&
    pilotEmailValid

  const handleSubmit = async () => {
    if (!pilotEmailValid) {
      addToast({ type: 'error', message: 'Please provide a valid email for the pilot programme.' })
      return
    }
    const success = await submitVotes({
      ideaIds: [...selectedIds],
      customIdea: customIdea || undefined,
      ranking: ranking.length > 0 ? ranking : [...selectedIds],
      wtpBand: wtpBand || undefined,
      urgency: urgency || undefined,
      pilotOptIn,
      pilotEmail: pilotOptIn ? pilotEmail.trim() : undefined,
    })
    if (success) {
      try {
        sessionStorage.removeItem(CUSTOM_IDEA_KEY)
        sessionStorage.removeItem(RANKING_KEY)
        sessionStorage.removeItem(WTP_KEY)
        sessionStorage.removeItem(URGENCY_KEY)
        sessionStorage.removeItem(PILOT_OPTIN_KEY)
        sessionStorage.removeItem(PILOT_EMAIL_KEY)
      } catch {
        // Ignore
      }
      navigate('/vote/thankyou')
    } else {
      addToast({ type: 'error', message: 'Error submitting votes. Please try again.' })
    }
  }

  return (
    <AppShell
      topNav={
        <header className="h-16 bg-surface/80 backdrop-blur-md border-b border-border px-6 flex items-center sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent/60 rounded-lg flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-text">APX Innovation Platform</span>
          </div>
        </header>
      }
    >
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate('/vote/ideas')}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to ideas
        </Button>

        <div className="animate-fade-in">
          <h1 className="font-display text-3xl text-text mb-2">Confirm Your Selection</h1>
          <p className="text-text-muted mb-8">
            Review selected ideas, rank them, share your willingness to pay, and opt-in to a pilot.
          </p>
        </div>

        <div className="space-y-6">
          {/* Selected ideas summary - removable mini-cards */}
          <Card>
            <h3 className="text-sm font-semibold text-text mb-3">
              Your selected ideas ({selectedIdeas.length})
            </h3>
            <div className="space-y-2">
              {selectedIdeas.map((idea, i) => (
                <div
                  key={idea.id}
                  className="flex items-center gap-3 p-3 bg-surface-2 rounded-lg border border-border group"
                >
                  <span className="text-accent font-mono text-sm w-6 shrink-0">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text">{idea.name}</span>
                      <Badge variant="info" className="hidden sm:inline-flex">
                        {idea.category}
                      </Badge>
                    </div>
                    <span className="text-xs text-text-muted">{idea.tagline}</span>
                  </div>
                  <button
                    onClick={() => toggleSelect(idea.id)}
                    className="p-1 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                    title="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {selectedIdeas.length === 0 && (
                <p className="text-sm text-text-muted text-center py-4">
                  No ideas selected.{' '}
                  <button
                    onClick={() => navigate('/vote/ideas')}
                    className="text-accent hover:underline cursor-pointer"
                  >
                    Back to selection
                  </button>
                </p>
              )}
            </div>
          </Card>

          {/* Custom idea textarea */}
          <Card>
            <label className="block text-sm font-semibold text-text mb-2">
              Do you have your own idea for a SAP tool?
            </label>
            <p className="text-xs text-text-muted mb-3">
              Optionally describe your idea for an innovative SAP on AWS solution.
            </p>
            <textarea
              placeholder="Describe the problem you'd like to solve..."
              value={customIdea}
              onChange={(e) => setCustomIdea(e.target.value.slice(0, maxChars))}
              rows={5}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors resize-y min-h-[120px]"
            />
            <div className="flex justify-end mt-1">
              <span
                className={`text-xs ${charCount > maxChars * 0.9 ? 'text-warning' : 'text-text-muted'}`}
              >
                {charCount}/{maxChars} characters
              </span>
            </div>
          </Card>

          {/* WP-20 Section 1: Rank your selected ideas */}
          {selectedIdeas.length > 0 && (
            <Card>
              <h3 className="text-sm font-semibold text-text mb-1">Rank your selected ideas</h3>
              <p className="text-xs text-text-muted mb-4">
                Drag to rank: 1 = most important to you
              </p>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={ranking} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {rankedIdeas.map((idea, index) => (
                      <SortableRankRow
                        key={idea.id}
                        id={idea.id}
                        index={index}
                        name={idea.name}
                        category={idea.category}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </Card>
          )}

          {/* WP-20 Section 2: Willingness to pay */}
          <Card>
            <h3 className="text-sm font-semibold text-text mb-1">Willingness to pay</h3>
            <p className="text-xs text-text-muted mb-4">
              Realistically, what would your organization pay for the TOP idea you selected?
              (per month, per system)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {WTP_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    wtpBand === opt.value
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-surface-2 hover:border-border-hover'
                  }`}
                >
                  <input
                    type="radio"
                    name="wtpBand"
                    value={opt.value}
                    checked={wtpBand === opt.value}
                    onChange={() => setWtpBand(opt.value)}
                    className="accent-accent"
                  />
                  <span className="text-sm text-text">{opt.label}</span>
                </label>
              ))}
            </div>
          </Card>

          {/* WP-20 Section 3: Urgency */}
          <Card>
            <h3 className="text-sm font-semibold text-text mb-1">Urgency</h3>
            <p className="text-xs text-text-muted mb-4">
              When would you want to use this?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {URGENCY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    urgency === opt.value
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-surface-2 hover:border-border-hover'
                  }`}
                >
                  <input
                    type="radio"
                    name="urgency"
                    value={opt.value}
                    checked={urgency === opt.value}
                    onChange={() => setUrgency(opt.value)}
                    className="accent-accent"
                  />
                  <span className="text-sm text-text">{opt.label}</span>
                </label>
              ))}
            </div>
          </Card>

          {/* WP-20 Section 4: Pilot opt-in */}
          <Card>
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={pilotOptIn}
                  onChange={(e) => setPilotOptIn(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="w-5 h-5 rounded-md border-2 border-border bg-surface-2 peer-checked:bg-accent peer-checked:border-accent transition-colors flex items-center justify-center">
                  {pilotOptIn && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <span className="text-sm font-semibold text-text">
                  I'd be interested in joining a pilot programme for one of these ideas
                </span>
                <p className="text-xs text-text-muted mt-1">
                  We'll contact you before launching a pilot.
                </p>
              </div>
            </label>

            {pilotOptIn && (
              <div className="mt-4">
                <label className="block text-xs text-text-muted mb-1">Contact email</label>
                <input
                  type="email"
                  value={pilotEmail}
                  onChange={(e) => setPilotEmail(e.target.value)}
                  placeholder="you@company.com"
                  className={`w-full px-3 py-2 bg-surface-2 border rounded-lg text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-colors ${
                    pilotEmailValid ? 'border-border focus:border-accent' : 'border-danger'
                  }`}
                />
                {!pilotEmailValid && (
                  <p className="text-xs text-danger mt-1">Please enter a valid email.</p>
                )}
              </div>
            )}
          </Card>

          {/* Consent checkbox */}
          <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border border-border bg-surface hover:border-border-hover transition-colors">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="peer sr-only"
              />
              <div className="w-5 h-5 rounded-md border-2 border-border bg-surface-2 peer-checked:bg-accent peer-checked:border-accent transition-colors flex items-center justify-center">
                {consent && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-text-muted leading-relaxed">
              I agree to be contacted regarding pilot programs and consent to my responses being
              used for product analysis and development. My data will be treated confidentially.
            </span>
          </label>

          {/* Submit button */}
          <button
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="w-full py-4 rounded-xl text-white font-semibold text-lg transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent shadow-lg shadow-accent/20 hover:shadow-accent/30 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Vote'
            )}
          </button>
        </div>
      </div>
    </AppShell>
  )
}

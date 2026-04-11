import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Lightbulb,
  Clock,
  Sparkles,
  FileSpreadsheet,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { AppShell } from '../../components/layout/AppShell'
import { TopNav } from '../../components/layout/TopNav'
import { Sidebar } from '../../components/layout/Sidebar'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useIdeasStore } from '../../stores/ideasStore'
import { useCustomersStore } from '../../stores/customersStore'
import { useResultsStore } from '../../stores/resultsStore'

export default function TeamDashboard() {
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState(false)

  const { ideas, fetchIdeas } = useIdeasStore()
  const { customers, fetchCustomers, loading: customersLoading, error: customersError } = useCustomersStore()
  const { voteResults, customIdeas, fetchAll, loading: resultsLoading, error: resultsError } = useResultsStore()

  const loading = customersLoading || resultsLoading
  const error = customersError || resultsError

  useEffect(() => {
    const load = async () => {
      await Promise.all([
        fetchIdeas(),
        fetchCustomers(),
        fetchAll(),
      ])
      setLoaded(true)
    }
    load()
  }, [fetchIdeas, fetchCustomers, fetchAll])

  // Polling refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchIdeas()
      fetchCustomers()
      fetchAll()
    }, 30_000)
    return () => clearInterval(interval)
  }, [fetchIdeas, fetchCustomers, fetchAll])

  // Computed values
  const votersCount = voteResults?.totalVoters ?? 0
  const votersTotal = customers.length || votersCount
  const voterPercentage = votersTotal > 0 ? Math.round((votersCount / votersTotal) * 100) : 0

  // Top idea: find the idea with the most votes
  const topIdeaEntry = voteResults?.votesByIdea
    ? Object.entries(voteResults.votesByIdea).sort(([, a], [, b]) => b - a)[0]
    : null
  const topIdeaId = topIdeaEntry?.[0]
  const topIdeaVotes = topIdeaEntry?.[1] ?? 0
  const topIdea = ideas.find((i) => i.id === topIdeaId)
  const topIdeaName = topIdea?.name ?? (topIdeaId ? topIdeaId : 'Brak glosow')

  // Custom ideas count
  const customIdeasCount = customIdeas.length
  const newCustomIdeas = customIdeas.filter((ci) => ci.status === 'pending').length

  // Chart data: ideas sorted by vote count
  const chartData = voteResults?.votesByIdea
    ? Object.entries(voteResults.votesByIdea)
        .map(([ideaId, votes]) => {
          const idea = ideas.find((i) => i.id === ideaId)
          return {
            name: idea?.name ?? ideaId,
            votes,
          }
        })
        .sort((a, b) => b.votes - a.votes)
        .slice(0, 8)
    : []

  // Activity: derive from customers who have voted recently
  const recentActivity = customers
    .filter((c) => c.lastLogin)
    .sort((a, b) => (b.lastLogin ?? '').localeCompare(a.lastLogin ?? ''))
    .slice(0, 5)
    .map((c) => ({
      email: c.email,
      company: c.company,
      action: c.hasVoted ? 'Zaglosowal' : 'Zalogowany',
      date: c.lastLogin ?? '',
      color: c.hasVoted ? 'text-success' : 'text-accent',
    }))

  if (loading && !loaded) {
    return (
      <AppShell topNav={<TopNav />} sidebar={<Sidebar />}>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell topNav={<TopNav />} sidebar={<Sidebar />}>
      <div className="p-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="font-display text-3xl text-text mb-2 tracking-tight">Dashboard</h1>
          <p className="text-text-secondary">Przeglad aktywnosci i statystyk platformy</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-error/10 border border-error/30 rounded-xl text-sm text-error">
            Blad ladowania danych: {error}
          </div>
        )}

        {/* Metric cards - glass morphism */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 transition-all duration-700 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {/* Glosujacych */}
          <div className="glass rounded-xl p-6 relative overflow-hidden group hover:border-accent/20 transition-all duration-300">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-colors" />
            <div className="flex items-start justify-between relative">
              <div>
                <p className="text-sm text-text-muted mb-1">Glosujacych</p>
                <p className="text-3xl font-semibold text-text">
                  {votersCount}
                  <span className="text-lg text-text-muted">/{votersTotal}</span>
                </p>
                <p className="text-xs text-text-muted mt-1">{voterPercentage}% partycypacji</p>
              </div>
              <div className="relative w-14 h-14">
                <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    fill="none"
                    stroke="#4A9EFF"
                    strokeWidth="4"
                    strokeDasharray={`${voterPercentage * 1.508} 150.8`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <Users className="w-4 h-4 text-accent absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          {/* Top pomysl */}
          <div className="glass rounded-xl p-6 relative overflow-hidden group hover:border-warning/20 transition-all duration-300">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-warning/5 rounded-full blur-2xl group-hover:bg-warning/10 transition-colors" />
            <div className="relative">
              <p className="text-sm text-text-muted mb-1">Top pomysl</p>
              <p className="text-lg font-semibold text-text leading-tight">{topIdeaName}</p>
              {topIdeaVotes > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-2xl font-semibold text-warning">{topIdeaVotes}</span>
                  <span className="text-xs text-text-muted">glosow</span>
                </div>
              )}
            </div>
          </div>

          {/* Pomyslow klientow */}
          <div className="glass rounded-xl p-6 relative overflow-hidden group hover:border-success/20 transition-all duration-300">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-success/5 rounded-full blur-2xl group-hover:bg-success/10 transition-colors" />
            <div className="flex items-start justify-between relative">
              <div>
                <p className="text-sm text-text-muted mb-1">Pomyslow klientow</p>
                <p className="text-3xl font-semibold text-text">{customIdeasCount}</p>
                {newCustomIdeas > 0 && (
                  <p className="text-xs text-success mt-1">{newCustomIdeas} nowe</p>
                )}
              </div>
              <div className="p-2 rounded-lg bg-success/10">
                <Lightbulb className="w-5 h-5 text-success" />
              </div>
            </div>
          </div>

          {/* Czas do deadline */}
          <div className="glass rounded-xl p-6 relative overflow-hidden group hover:border-purple/20 transition-all duration-300">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-purple/5 rounded-full blur-2xl group-hover:bg-purple/10 transition-colors" />
            <div className="flex items-start justify-between relative">
              <div>
                <p className="text-sm text-text-muted mb-1">Czas do deadline</p>
                {(() => {
                  // Find the nearest future voting deadline from customers
                  const now = new Date()
                  const deadlines = customers
                    .map((c) => c.votingDeadline)
                    .filter((d): d is string => !!d)
                    .map((d) => new Date(d))
                    .filter((d) => d > now)
                    .sort((a, b) => a.getTime() - b.getTime())
                  if (deadlines.length > 0) {
                    const daysLeft = Math.ceil((deadlines[0].getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                    return (
                      <>
                        <p className="text-3xl font-semibold text-text">{daysLeft}</p>
                        <p className="text-xs text-text-muted mt-1">dni pozostalo</p>
                      </>
                    )
                  }
                  return <p className="text-lg font-semibold text-text-muted mt-1">Brak deadline</p>
                })()}
              </div>
              <div className="p-2 rounded-lg bg-purple/10">
                <Clock className="w-5 h-5 text-purple" />
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <Card className={`mb-8 transition-all duration-700 delay-200 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text">Ranking pomyslow wg glosow</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/team/results')}>
              Pelne wyniki
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
          <div className="h-72">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis type="number" tick={{ fill: '#555770', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fill: '#8b8d98', fontSize: 12 }}
                    width={140}
                    axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#10111a',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 12,
                      color: '#f0eeea',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                    }}
                    cursor={{ fill: 'rgba(74,158,255,0.04)' }}
                  />
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#4A9EFF" />
                      <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                  <Bar dataKey="votes" fill="url(#barGradient)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-text-muted text-sm">
                Brak danych do wyswietlenia
              </div>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity feed */}
          <Card className={`lg:col-span-2 transition-all duration-700 delay-300 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <h3 className="text-sm font-semibold text-text mb-4">Ostatnia aktywnosc</h3>
            <div className="space-y-3">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-4 p-3 rounded-lg bg-surface-2/50 border border-border hover:border-border-hover transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-xs font-medium text-text-muted uppercase">
                      {activity.email[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-text truncate">{activity.email}</span>
                        <span className="text-xs text-text-muted">{activity.company}</span>
                      </div>
                      <span className={`text-xs ${activity.color}`}>{activity.action}</span>
                    </div>
                    <span className="text-xs text-text-muted shrink-0">{activity.date}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-text-muted text-sm">
                  Brak aktywnosci
                </div>
              )}
            </div>
          </Card>

          {/* Quick actions */}
          <Card className={`transition-all duration-700 delay-400 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <h3 className="text-sm font-semibold text-text mb-4">Szybkie akcje</h3>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/team/customers')}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-surface-2 border border-border hover:border-accent/30 transition-all cursor-pointer text-left group"
              >
                <div className="p-2 rounded-lg bg-accent/10 text-accent">
                  <Users className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text">Zapros klienta</p>
                  <p className="text-xs text-text-muted">Dodaj nowego uczestnika</p>
                </div>
                <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
              </button>

              <button
                onClick={() => navigate('/team/brainstorm')}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-surface-2 border border-border hover:border-purple/30 transition-all cursor-pointer text-left group"
              >
                <div className="p-2 rounded-lg bg-purple/10 text-purple">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text">Generuj pomysly AI</p>
                  <p className="text-xs text-text-muted">Burza mozgow z agentami</p>
                </div>
                <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-purple transition-colors" />
              </button>

              <button
                onClick={() => navigate('/team/results')}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-surface-2 border border-border hover:border-success/30 transition-all cursor-pointer text-left group"
              >
                <div className="p-2 rounded-lg bg-success/10 text-success">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text">Eksport wynikow</p>
                  <p className="text-xs text-text-muted">CSV lub PDF</p>
                </div>
                <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-success transition-colors" />
              </button>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}

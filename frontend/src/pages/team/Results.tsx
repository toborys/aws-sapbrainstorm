import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Download, FileSpreadsheet, Filter, Loader2 } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { TopNav } from '../../components/layout/TopNav'
import { Sidebar } from '../../components/layout/Sidebar'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { useIdeasStore } from '../../stores/ideasStore'
import { useResultsStore } from '../../stores/resultsStore'
import type { IdeaCategory } from '../../types'

const CATEGORIES: IdeaCategory[] = [
  'Monitoring & Observability',
  'Security & Compliance',
  'Automation',
  'Migration & Modernization',
  'Analytics & Insights',
  'Performance Testing',
]

const CATEGORY_SHORT_LABELS: Record<string, string> = {
  'Monitoring & Observability': 'Monitoring',
  'Security & Compliance': 'Security',
  'Automation': 'Automation',
  'Migration & Modernization': 'Migration',
  'Analytics & Insights': 'Analytics',
  'Performance Testing': 'Performance',
}

const CATEGORY_COLORS: Record<string, string> = {
  'Monitoring & Observability': '#4A9EFF',
  'Security & Compliance': '#f87171',
  'Automation': '#34d399',
  'Migration & Modernization': '#fbbf24',
  'Analytics & Insights': '#a78bfa',
  'Performance Testing': '#ff9900',
}

const DEFAULT_COLOR = '#6BB3FF'

const trophyIcons: Record<number, string> = {
  1: '\u{1F947}',
  2: '\u{1F948}',
  3: '\u{1F949}',
}

export default function TeamResults() {
  const [categoryFilter, setCategoryFilter] = useState<IdeaCategory | null>(null)

  const { ideas, fetchIdeas } = useIdeasStore()
  const { voteResults, customIdeas, fetchAll, loading, error } = useResultsStore()

  useEffect(() => {
    fetchIdeas()
    fetchAll()
  }, [fetchIdeas, fetchAll])

  // Build ranked results from real data
  const rankedResults = (() => {
    if (!voteResults?.votesByIdea) return []
    return Object.entries(voteResults.votesByIdea)
      .map(([ideaId, votes]) => {
        const idea = ideas.find((i) => i.id === ideaId)
        return {
          id: ideaId,
          name: idea?.name ?? ideaId,
          category: idea?.category ?? ('Automation' as IdeaCategory),
          votes,
          rank: 0,
        }
      })
      .sort((a, b) => b.votes - a.votes)
      .map((item, idx) => ({ ...item, rank: idx + 1 }))
  })()

  const filteredResults = categoryFilter
    ? rankedResults.filter((r) => r.category === categoryFilter)
    : rankedResults

  // Build pie chart data from category distribution
  const pieData = (() => {
    const categoryVotes: Record<string, number> = {}
    for (const result of rankedResults) {
      const cat = result.category
      categoryVotes[cat] = (categoryVotes[cat] || 0) + result.votes
    }
    return Object.entries(categoryVotes)
      .map(([name, value]) => ({
        name,
        value,
        color: CATEGORY_COLORS[name] || DEFAULT_COLOR,
      }))
      .sort((a, b) => b.value - a.value)
  })()

  // Collect unique categories that exist in the data
  const usedCategories = Array.from(new Set(rankedResults.map((r) => r.category)))
  const allCategories = CATEGORIES.filter((c) => usedCategories.includes(c))
  // Also add any categories from data that aren't in the predefined list
  for (const cat of usedCategories) {
    if (!allCategories.includes(cat)) {
      allCategories.push(cat)
    }
  }

  const handleExportCSV = () => {
    const csv = [
      'Rank,Idea,Category,Votes',
      ...filteredResults.map((r) => `${r.rank},"${r.name}",${r.category},${r.votes}`),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'voting-results.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportPDF = () => {
    window.print()
  }

  if (loading) {
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-text mb-2">Voting Results</h1>
            <p className="text-text-muted">
              Vote summary and idea ranking
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              icon={<FileSpreadsheet className="w-4 h-4" />}
              onClick={handleExportCSV}
            >
              Export CSV
            </Button>
            <Button
              variant="secondary"
              icon={<Download className="w-4 h-4" />}
              onClick={handleExportPDF}
            >
              Export PDF
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-error/10 border border-error/30 rounded-xl text-sm text-error">
            Error loading data: {error}
          </div>
        )}

        {/* Category filter */}
        <div className="flex items-center gap-3 mb-6">
          <Filter className="w-4 h-4 text-text-muted" />
          <div className="flex flex-wrap gap-1.5">
            <button
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                !categoryFilter
                  ? 'bg-accent text-white'
                  : 'bg-surface-2 text-text-muted hover:text-text border border-border'
              }`}
              onClick={() => setCategoryFilter(null)}
            >
              All
            </button>
            {(allCategories.length > 0 ? allCategories : CATEGORIES).map((cat) => (
              <button
                key={cat}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-accent text-white'
                    : 'bg-surface-2 text-text-muted hover:text-text border border-border'
                }`}
                onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
              >
                {CATEGORY_SHORT_LABELS[cat] || cat}
              </button>
            ))}
          </div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Bar chart */}
          <Card className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-text mb-4">Idea Ranking</h3>
            <div className="h-80">
              {filteredResults.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredResults} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis type="number" tick={{ fill: '#555770', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fill: '#8b8d98', fontSize: 11 }}
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
                      <linearGradient id="resultBarGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#4A9EFF" />
                        <stop offset="100%" stopColor="#a78bfa" />
                      </linearGradient>
                    </defs>
                    <Bar dataKey="votes" fill="url(#resultBarGradient)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-text-muted text-sm">
                  No data to display
                </div>
              )}
            </div>
          </Card>

          {/* Pie chart */}
          <Card>
            <h3 className="text-sm font-semibold text-text mb-4">Category Distribution</h3>
            <div className="h-64">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#10111a',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 12,
                        color: '#f0eeea',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-text-muted text-sm">
                  No data
                </div>
              )}
            </div>
            <div className="space-y-2 mt-2">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-text-muted">{CATEGORY_SHORT_LABELS[item.name] || item.name}</span>
                  </div>
                  <span className="text-text font-mono">{item.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Ranked table */}
        <Card className="mb-8">
          <h3 className="text-sm font-semibold text-text mb-4">Results Table</h3>
          <div className="overflow-x-auto">
            {filteredResults.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-3 text-text-muted font-medium w-16">#</th>
                    <th className="pb-3 text-text-muted font-medium">Idea</th>
                    <th className="pb-3 text-text-muted font-medium">Category</th>
                    <th className="pb-3 text-text-muted font-medium text-right">Votes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-b border-border/50 transition-colors ${
                        row.rank <= 3 ? 'bg-accent/[0.02]' : ''
                      }`}
                    >
                      <td className="py-4">
                        {row.rank <= 3 ? (
                          <span className="text-xl">{trophyIcons[row.rank]}</span>
                        ) : (
                          <span className="text-text-muted font-mono pl-1">{row.rank}</span>
                        )}
                      </td>
                      <td className="py-4">
                        <span className="text-text font-medium">{row.name}</span>
                      </td>
                      <td className="py-4">
                        <Badge variant="info">{row.category}</Badge>
                      </td>
                      <td className="py-4 text-right">
                        <span className="text-text font-mono text-lg">{row.votes}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12 text-text-muted text-sm">
                No results to display
              </div>
            )}
          </div>
        </Card>

        {/* Custom ideas section */}
        <Card>
          <h3 className="text-sm font-semibold text-text mb-4">
            Customer Custom Ideas ({customIdeas.length})
          </h3>
          <div className="space-y-3">
            {customIdeas.length > 0 ? (
              customIdeas.map((idea) => (
                <div
                  key={idea.id}
                  className="p-4 bg-surface-2 rounded-xl border border-border hover:border-border-hover transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text">{idea.title}</span>
                      <Badge
                        variant={
                          idea.status === 'pending'
                            ? 'warning'
                            : idea.status === 'reviewed'
                            ? 'info'
                            : 'success'
                        }
                      >
                        {idea.status === 'pending'
                          ? 'Pending'
                          : idea.status === 'reviewed'
                          ? 'Reviewed'
                          : 'Approved'}
                      </Badge>
                    </div>
                    <span className="text-xs text-text-muted">{idea.company}</span>
                  </div>
                  <p className="text-sm text-text-muted">{idea.description}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-text-muted text-sm">
                No custom ideas from customers
              </div>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  )
}

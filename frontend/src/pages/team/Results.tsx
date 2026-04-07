import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Download, FileSpreadsheet, Trophy } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { TopNav } from '../../components/layout/TopNav'
import { Sidebar } from '../../components/layout/Sidebar'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'

const mockResults = [
  { name: 'SAP Cost Optimizer', category: 'Monitoring', votes: 18, rank: 1 },
  { name: 'Auto-Scale Engine', category: 'Automation', votes: 15, rank: 2 },
  { name: 'Security Shield', category: 'Security', votes: 14, rank: 3 },
  { name: 'Data Lake Connector', category: 'Analytics', votes: 12, rank: 4 },
  { name: 'Migration Accelerator', category: 'Migration', votes: 10, rank: 5 },
  { name: 'Performance Monitor', category: 'Performance', votes: 8, rank: 6 },
]

const barColors = ['#4A9EFF', '#4A9EFF', '#4A9EFF', '#888888', '#888888', '#888888']

const mockCustomIdeas = [
  {
    id: '1',
    company: 'Firma A',
    title: 'Integracja z SAP Fiori',
    description: 'Automatyczna integracja dashboardow z SAP Fiori dla lepszej wizualizacji.',
    status: 'pending' as const,
  },
  {
    id: '2',
    company: 'Corp B',
    title: 'AI anomaly detection',
    description: 'Wykrywanie anomalii w transakcjach SAP przy uzyciu modeli ML na AWS SageMaker.',
    status: 'reviewed' as const,
  },
]

export default function TeamResults() {
  const [_tab, setTab] = useState<'chart' | 'custom'>('chart')

  const handleExportCSV = () => {
    // TODO: implement CSV export
  }

  const handleExportPDF = () => {
    // TODO: implement PDF export
  }

  return (
    <AppShell topNav={<TopNav />} sidebar={<Sidebar />}>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-text mb-2">Wyniki glosowania</h1>
            <p className="text-text-muted">
              Podsumowanie glosow i ranking pomyslow
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              icon={<FileSpreadsheet className="w-4 h-4" />}
              onClick={handleExportCSV}
            >
              Eksport CSV
            </Button>
            <Button
              variant="secondary"
              icon={<Download className="w-4 h-4" />}
              onClick={handleExportPDF}
            >
              Eksport PDF
            </Button>
          </div>
        </div>

        {/* Bar chart */}
        <Card className="mb-8">
          <h3 className="text-sm font-semibold text-text mb-4">Ranking pomyslow</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockResults} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A3E" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#888888', fontSize: 11 }}
                  angle={-20}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: '#888888', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1A1A2E',
                    border: '1px solid #2A2A3E',
                    borderRadius: 8,
                    color: '#E8E6E0',
                  }}
                />
                <Bar dataKey="votes" radius={[4, 4, 0, 0]}>
                  {mockResults.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={barColors[index] || '#888888'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Ranked table */}
        <Card className="mb-8">
          <h3 className="text-sm font-semibold text-text mb-4">Tabela wynikow</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 text-text-muted font-medium w-12">#</th>
                  <th className="pb-3 text-text-muted font-medium">Pomysl</th>
                  <th className="pb-3 text-text-muted font-medium">Kategoria</th>
                  <th className="pb-3 text-text-muted font-medium text-right">Glosy</th>
                </tr>
              </thead>
              <tbody>
                {mockResults.map((row) => (
                  <tr key={row.rank} className="border-b border-border/50">
                    <td className="py-3">
                      {row.rank <= 3 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold">
                          <Trophy className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="text-text-muted font-mono">{row.rank}</span>
                      )}
                    </td>
                    <td className="py-3 text-text font-medium">{row.name}</td>
                    <td className="py-3">
                      <Badge variant="info">{row.category}</Badge>
                    </td>
                    <td className="py-3 text-right text-text font-mono">{row.votes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Custom ideas section */}
        <Card>
          <h3 className="text-sm font-semibold text-text mb-4">
            Pomysly wlasne klientow ({mockCustomIdeas.length})
          </h3>
          <div className="space-y-3">
            {mockCustomIdeas.map((idea) => (
              <div
                key={idea.id}
                className="p-4 bg-surface-2 rounded-lg border border-border"
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
                        ? 'Oczekuje'
                        : idea.status === 'reviewed'
                        ? 'Przegladniety'
                        : 'Zaakceptowany'}
                    </Badge>
                  </div>
                  <span className="text-xs text-text-muted">{idea.company}</span>
                </div>
                <p className="text-sm text-text-muted">{idea.description}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  )
}

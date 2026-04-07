import { useState, useEffect } from 'react'
import { Users, Lightbulb, BarChart3, TrendingUp } from 'lucide-react'
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

interface MetricCard {
  label: string
  value: string
  change?: string
  icon: React.ElementType
  color: string
}

const mockMetrics: MetricCard[] = [
  { label: 'Zaproszeni klienci', value: '24', change: '+3 ten tydzien', icon: Users, color: 'text-accent' },
  { label: 'Aktywne pomysly', value: '12', icon: Lightbulb, color: 'text-warning' },
  { label: 'Oddane glosy', value: '18', change: '75% partycypacji', icon: BarChart3, color: 'text-success' },
  { label: 'Srednia ocen', value: '4.2', icon: TrendingUp, color: 'text-purple' },
]

const mockChartData = [
  { name: 'Monitoring', votes: 14 },
  { name: 'Security', votes: 11 },
  { name: 'Automation', votes: 18 },
  { name: 'Migration', votes: 8 },
  { name: 'Analytics', votes: 12 },
  { name: 'Performance', votes: 9 },
]

const mockActivity = [
  { email: 'jan@firma.pl', company: 'Firma A', voted: true, date: '2026-04-07' },
  { email: 'anna@corp.pl', company: 'Corp B', voted: true, date: '2026-04-06' },
  { email: 'piotr@tech.pl', company: 'Tech C', voted: false, date: '-' },
  { email: 'kasia@enterprise.pl', company: 'Enterprise D', voted: true, date: '2026-04-05' },
  { email: 'marek@partner.pl', company: 'Partner E', voted: false, date: '-' },
]

export default function TeamDashboard() {
  const [_loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(true)
  }, [])

  return (
    <AppShell topNav={<TopNav />} sidebar={<Sidebar />}>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl text-text mb-2">Dashboard</h1>
          <p className="text-text-muted">Przeglad aktywnosci i statystyk platformy</p>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {mockMetrics.map((metric) => (
            <Card key={metric.label} hover>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-text-muted mb-1">{metric.label}</p>
                  <p className="text-3xl font-semibold text-text">{metric.value}</p>
                  {metric.change && (
                    <p className="text-xs text-text-muted mt-1">{metric.change}</p>
                  )}
                </div>
                <div className={`p-2 rounded-lg bg-surface-2 ${metric.color}`}>
                  <metric.icon className="w-5 h-5" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Chart */}
        <Card className="mb-8">
          <h3 className="text-sm font-semibold text-text mb-4">Glosy wg kategorii</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockChartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A3E" />
                <XAxis type="number" tick={{ fill: '#888888', fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#888888', fontSize: 12 }} width={100} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1A1A2E',
                    border: '1px solid #2A2A3E',
                    borderRadius: 8,
                    color: '#E8E6E0',
                  }}
                />
                <Bar dataKey="votes" fill="#4A9EFF" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Activity table */}
        <Card>
          <h3 className="text-sm font-semibold text-text mb-4">Aktywnosc klientow</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 text-text-muted font-medium">Email</th>
                  <th className="pb-3 text-text-muted font-medium">Firma</th>
                  <th className="pb-3 text-text-muted font-medium">Status</th>
                  <th className="pb-3 text-text-muted font-medium">Data glosowania</th>
                </tr>
              </thead>
              <tbody>
                {mockActivity.map((row) => (
                  <tr key={row.email} className="border-b border-border/50">
                    <td className="py-3 text-text">{row.email}</td>
                    <td className="py-3 text-text-muted">{row.company}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          row.voted
                            ? 'bg-success/20 text-success'
                            : 'bg-warning/20 text-warning'
                        }`}
                      >
                        {row.voted ? 'Zaglosowal' : 'Oczekuje'}
                      </span>
                    </td>
                    <td className="py-3 text-text-muted">{row.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  )
}

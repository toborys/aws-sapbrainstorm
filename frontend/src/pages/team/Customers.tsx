import { useState } from 'react'
import {
  UserPlus,
  Upload,
  RotateCw,
  Search,
} from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { TopNav } from '../../components/layout/TopNav'
import { Sidebar } from '../../components/layout/Sidebar'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'

interface CustomerRow {
  userId: string
  email: string
  company: string
  hasVoted: boolean
  invitedAt: string
  lastLogin?: string
  votingDeadline?: string
}

const mockCustomers: CustomerRow[] = [
  {
    userId: '1',
    email: 'jan@firma.pl',
    company: 'Firma A',
    hasVoted: true,
    invitedAt: '2026-03-20',
    lastLogin: '2026-04-07',
    votingDeadline: '2026-04-15',
  },
  {
    userId: '2',
    email: 'anna@corp.pl',
    company: 'Corp B',
    hasVoted: true,
    invitedAt: '2026-03-21',
    lastLogin: '2026-04-06',
    votingDeadline: '2026-04-15',
  },
  {
    userId: '3',
    email: 'piotr@tech.pl',
    company: 'Tech C',
    hasVoted: false,
    invitedAt: '2026-03-22',
    votingDeadline: '2026-04-15',
  },
  {
    userId: '4',
    email: 'kasia@enterprise.pl',
    company: 'Enterprise D',
    hasVoted: true,
    invitedAt: '2026-03-25',
    lastLogin: '2026-04-05',
    votingDeadline: '2026-04-15',
  },
  {
    userId: '5',
    email: 'marek@partner.pl',
    company: 'Partner E',
    hasVoted: false,
    invitedAt: '2026-04-01',
    votingDeadline: '2026-04-20',
  },
]

export default function TeamCustomers() {
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteCompany, setInviteCompany] = useState('')
  const [inviteDeadline, setInviteDeadline] = useState('')

  const filteredCustomers = mockCustomers.filter(
    (c) =>
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.company.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleInvite = () => {
    // TODO: call api.inviteCustomer
    setShowInviteModal(false)
    setInviteEmail('')
    setInviteCompany('')
    setInviteDeadline('')
  }

  const handleResend = (_userId: string) => {
    // TODO: call api.resendInvite
  }

  return (
    <AppShell topNav={<TopNav />} sidebar={<Sidebar />}>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-text mb-2">Klienci</h1>
            <p className="text-text-muted">
              Zarzadzaj zaproszonymi klientami i monitoruj ich aktywnosc
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              icon={<Upload className="w-4 h-4" />}
              onClick={() => setShowBulkModal(true)}
            >
              Import zbiorczy
            </Button>
            <Button
              variant="primary"
              icon={<UserPlus className="w-4 h-4" />}
              onClick={() => setShowInviteModal(true)}
            >
              Zapros klienta
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Szukaj po emailu lub firmie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-2 border border-border rounded-lg text-text text-sm placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
          />
        </div>

        {/* Customer table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 text-text-muted font-medium">Email</th>
                  <th className="pb-3 text-text-muted font-medium">Firma</th>
                  <th className="pb-3 text-text-muted font-medium">Status</th>
                  <th className="pb-3 text-text-muted font-medium">Zaproszony</th>
                  <th className="pb-3 text-text-muted font-medium">Ostatnie logowanie</th>
                  <th className="pb-3 text-text-muted font-medium">Deadline</th>
                  <th className="pb-3 text-text-muted font-medium text-right">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.userId} className="border-b border-border/50">
                    <td className="py-3 text-text">{customer.email}</td>
                    <td className="py-3 text-text-muted">{customer.company}</td>
                    <td className="py-3">
                      <Badge variant={customer.hasVoted ? 'success' : 'warning'}>
                        {customer.hasVoted ? 'Zaglosowal' : 'Oczekuje'}
                      </Badge>
                    </td>
                    <td className="py-3 text-text-muted">{customer.invitedAt}</td>
                    <td className="py-3 text-text-muted">{customer.lastLogin || '-'}</td>
                    <td className="py-3 text-text-muted">{customer.votingDeadline || '-'}</td>
                    <td className="py-3 text-right">
                      {!customer.hasVoted && (
                        <button
                          onClick={() => handleResend(customer.userId)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-accent hover:bg-accent/10 transition-colors cursor-pointer"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          Przypomnij
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredCustomers.length === 0 && (
            <div className="text-center py-8 text-text-muted text-sm">
              Brak klientow pasujacych do wyszukiwania.
            </div>
          )}
        </Card>
      </div>

      {/* Invite modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Zapros klienta"
      >
        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="klient@firma.pl"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <Input
            label="Firma"
            placeholder="Nazwa firmy"
            value={inviteCompany}
            onChange={(e) => setInviteCompany(e.target.value)}
          />
          <Input
            label="Deadline glosowania"
            type="date"
            value={inviteDeadline}
            onChange={(e) => setInviteDeadline(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowInviteModal(false)}>
              Anuluj
            </Button>
            <Button variant="primary" onClick={handleInvite}>
              Wyslij zaproszenie
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk invite modal */}
      <Modal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        title="Import zbiorczy klientow"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Przygotuj plik CSV z kolumnami: email, firma, deadline (YYYY-MM-DD).
          </p>
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <Upload className="w-8 h-8 mx-auto mb-3 text-text-muted" />
            <p className="text-sm text-text-muted mb-2">
              Przeciagnij plik CSV lub kliknij aby wybrac
            </p>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              id="csv-upload"
              onChange={() => {
                // TODO: parse CSV
              }}
            />
            <label htmlFor="csv-upload">
              <Button variant="secondary" size="sm" onClick={() => document.getElementById('csv-upload')?.click()}>
                Wybierz plik
              </Button>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowBulkModal(false)}>
              Anuluj
            </Button>
            <Button variant="primary" disabled>
              Importuj
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}

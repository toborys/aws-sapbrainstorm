import { useState, useEffect } from 'react'
import {
  UserPlus,
  Upload,
  RotateCw,
  Search,
  Clock,
  CheckCircle,
  Mail,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { TopNav } from '../../components/layout/TopNav'
import { Sidebar } from '../../components/layout/Sidebar'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { inviteCustomer } from '../../api/client'
import { useCustomersStore } from '../../stores/customersStore'
import { useUiStore } from '../../stores/uiStore'
import type { UserProfile } from '../../types'

type CustomerStatus = 'invited' | 'active' | 'voted'

function deriveStatus(customer: UserProfile): CustomerStatus {
  if (customer.hasVoted) return 'voted'
  if (customer.lastLogin) return 'active'
  return 'invited'
}

const statusConfig = {
  invited: { label: 'Invited', variant: 'default' as const, icon: Mail },
  active: { label: 'Active', variant: 'warning' as const, icon: Clock },
  voted: { label: 'Voted', variant: 'success' as const, icon: CheckCircle },
}

export default function TeamCustomers() {
  const { customers, loading, error, fetchCustomers } = useCustomersStore()
  const addToast = useUiStore((s) => s.addToast)

  const [inviting, setInviting] = useState(false)

  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteCompany, setInviteCompany] = useState('')
  const [inviteDeadline, setInviteDeadline] = useState('')
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | CustomerStatus>('all')

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const filteredCustomers = customers.filter((c) => {
    const status = deriveStatus(c)
    const matchesSearch =
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.company.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleInvite = async () => {
    setInviting(true)
    try {
      await inviteCustomer({
        email: inviteEmail,
        company: inviteCompany,
        votingDeadline: inviteDeadline || undefined,
      })
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteCompany('')
      setInviteDeadline('')
      addToast({ type: 'success', message: 'Invitation sent successfully' })
      // Refresh customer list
      await fetchCustomers()
    } catch (err) {
      addToast({ type: 'error', message: `Error: ${(err as Error).message}` })
    } finally {
      setInviting(false)
    }
  }

  const handleResend = (_userId: string) => {
    addToast({ type: 'info', message: 'Resend invitations: Coming soon' })
  }

  const handleBulkImport = () => {
    setShowBulkModal(false)
    addToast({ type: 'info', message: 'Bulk import: Coming soon' })
  }

  const stats = {
    total: customers.length,
    invited: customers.filter((c) => deriveStatus(c) === 'invited').length,
    active: customers.filter((c) => deriveStatus(c) === 'active').length,
    voted: customers.filter((c) => deriveStatus(c) === 'voted').length,
  }

  if (loading && customers.length === 0) {
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
            <h1 className="font-display text-3xl text-text mb-2">Customers</h1>
            <p className="text-text-muted">
              Manage invited customers and monitor their activity
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              icon={<Upload className="w-4 h-4" />}
              onClick={() => setShowBulkModal(true)}
            >
              Bulk Import
            </Button>
            <Button
              variant="primary"
              icon={<UserPlus className="w-4 h-4" />}
              onClick={() => setShowInviteModal(true)}
            >
              Invite Customer
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-error/10 border border-error/30 rounded-xl text-sm text-error">
            Error loading data: {error}
          </div>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-text-muted mb-1">Total</p>
            <p className="text-2xl font-semibold text-text">{stats.total}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-text-muted mb-1">Invited</p>
            <p className="text-2xl font-semibold text-text-muted">{stats.invited}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-text-muted mb-1">Active</p>
            <p className="text-2xl font-semibold text-warning">{stats.active}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-text-muted mb-1">Voted</p>
            <p className="text-2xl font-semibold text-success">{stats.voted}</p>
          </div>
        </div>

        {/* Search & filter */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search by email or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-2 border border-border rounded-lg text-text text-sm placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
          </div>
          <div className="flex gap-1.5">
            {[
              { value: 'all' as const, label: 'All' },
              { value: 'invited' as const, label: 'Invited' },
              { value: 'active' as const, label: 'Active' },
              { value: 'voted' as const, label: 'Voted' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === opt.value
                    ? 'bg-accent text-white'
                    : 'bg-surface-2 text-text-muted hover:text-text border border-border'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Customer cards */}
        <div className="space-y-3">
          {filteredCustomers.map((customer) => {
            const status = deriveStatus(customer)
            const config = statusConfig[status]
            const isExpanded = expandedCustomer === customer.userId

            return (
              <Card key={customer.userId} className="transition-all duration-200">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-sm font-medium text-text-muted uppercase shrink-0">
                    {customer.email[0]}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text">{customer.email}</span>
                      <Badge variant={config.variant}>
                        {config.label}
                      </Badge>
                    </div>
                    <span className="text-xs text-text-muted">{customer.company}</span>
                  </div>

                  <div className="hidden md:flex items-center gap-6 text-xs text-text-muted shrink-0">
                    <div>
                      <p className="text-text-muted/50">Invited</p>
                      <p>{customer.invitedAt}</p>
                    </div>
                    <div>
                      <p className="text-text-muted/50">Last login</p>
                      <p>{customer.lastLogin || '-'}</p>
                    </div>
                    <div>
                      <p className="text-text-muted/50">Deadline</p>
                      <p>{customer.votingDeadline || '-'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {status !== 'voted' && (
                      <button
                        onClick={() => handleResend(customer.userId)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-accent hover:bg-accent/10 transition-colors cursor-pointer"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        Remind
                      </button>
                    )}
                    <button
                      onClick={() =>
                        setExpandedCustomer(isExpanded ? null : customer.userId)
                      }
                      className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <h4 className="text-xs font-medium text-text-muted mb-3">Details</h4>
                    <div className="space-y-2 ml-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-text-muted">Role:</span>
                        <span className="text-text">{customer.role}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-text-muted">Voted:</span>
                        <span className="text-text">{customer.hasVoted ? 'Yes' : 'No'}</span>
                      </div>
                      {customer.votingDeadline && (
                        <div className="flex items-center gap-2">
                          <span className="text-text-muted">Voting deadline:</span>
                          <span className="text-text">{customer.votingDeadline}</span>
                        </div>
                      )}
                      {customer.invitedAt && (
                        <div className="flex items-center gap-2">
                          <span className="text-text-muted">Invitation date:</span>
                          <span className="text-text">{customer.invitedAt}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}

          {filteredCustomers.length === 0 && !loading && (
            <div className="text-center py-12 text-text-muted text-sm">
              {customers.length === 0
                ? 'No customers yet. Invite your first customer by clicking the button above.'
                : 'No customers match your search.'}
            </div>
          )}
        </div>
      </div>

      {/* Invite modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite Customer"
      >
        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="customer@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <Input
            label="Company"
            placeholder="Company name"
            value={inviteCompany}
            onChange={(e) => setInviteCompany(e.target.value)}
          />
          <Input
            label="Voting deadline"
            type="date"
            value={inviteDeadline}
            onChange={(e) => setInviteDeadline(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowInviteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleInvite}
              disabled={!inviteEmail || !inviteCompany || inviting}
            >
              {inviting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk invite modal */}
      <Modal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        title="Bulk Customer Import"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Prepare a CSV file with columns: email, company, deadline (YYYY-MM-DD).
          </p>
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-accent/30 transition-colors">
            <Upload className="w-8 h-8 mx-auto mb-3 text-text-muted" />
            <p className="text-sm text-text-muted mb-2">
              Drag a CSV file or click to select
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
                Choose file
              </Button>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowBulkModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleBulkImport}>
              Import
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}

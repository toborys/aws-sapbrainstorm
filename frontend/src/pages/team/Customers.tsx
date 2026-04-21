import { useState, useEffect, useRef } from 'react'
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
  FileDown,
  Copy,
  AlertCircle,
  X,
} from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { TopNav } from '../../components/layout/TopNav'
import { Sidebar } from '../../components/layout/Sidebar'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { inviteCustomer, bulkInviteCustomers, type BulkInviteResult } from '../../api/client'
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

interface ParsedRow {
  email: string
  company: string
  votingDeadline?: string
  valid: boolean
  reason?: string
}

// Inline CSV parser — no external dep. Handles simple comma-separated rows with optional
// double-quoted fields; detects an optional header row whose first line mentions "email".
function parseCsv(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return []

  let startIdx = 0
  if (/email/i.test(lines[0])) startIdx = 1

  const rows: ParsedRow[] = []
  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    const [email = '', company = '', votingDeadline = ''] = cols
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedCompany = company.trim()
    const trimmedDeadline = votingDeadline.trim()

    let valid = true
    let reason: string | undefined
    if (!trimmedEmail || !trimmedCompany) {
      valid = false
      reason = 'email and company required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      valid = false
      reason = 'invalid email format'
    } else if (trimmedDeadline && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDeadline)) {
      valid = false
      reason = 'deadline must be YYYY-MM-DD'
    }

    rows.push({
      email: trimmedEmail,
      company: trimmedCompany,
      votingDeadline: trimmedDeadline || undefined,
      valid,
      reason,
    })
  }
  return rows
}

const SAMPLE_CSV = `email,company,votingDeadline
alice@acme.com,Acme Corp,2026-05-15
bob@foo.com,Foo Inc,
`

function downloadFile(filename: string, content: string, mime = 'text/csv') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
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

  // Bulk import state
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState<string>('')
  const [bulkSending, setBulkSending] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkInviteResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const resetBulkState = () => {
    setParsedRows([])
    setFileName('')
    setBulkResult(null)
    setBulkSending(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCloseBulk = () => {
    const hadResult = bulkResult && bulkResult.invitedCount > 0
    setShowBulkModal(false)
    resetBulkState()
    if (hadResult) void fetchCustomers()
  }

  const handleFileSelected = async (file: File) => {
    setBulkResult(null)
    setFileName(file.name)
    try {
      const text = await file.text()
      const rows = parseCsv(text)
      if (rows.length === 0) {
        addToast({ type: 'error', message: 'CSV file is empty or unreadable' })
        setParsedRows([])
        return
      }
      setParsedRows(rows)
    } catch (err) {
      addToast({ type: 'error', message: `Failed to read CSV: ${(err as Error).message}` })
    }
  }

  const handleSendBulk = async () => {
    const valid = parsedRows.filter((r) => r.valid)
    if (valid.length === 0) {
      addToast({ type: 'error', message: 'No valid rows to invite' })
      return
    }
    setBulkSending(true)
    try {
      const result = await bulkInviteCustomers(
        valid.map((r) => ({
          email: r.email,
          company: r.company,
          votingDeadline: r.votingDeadline,
        })),
      )
      setBulkResult(result)
      if (result.invitedCount > 0) {
        addToast({
          type: 'success',
          message: `Invited ${result.invitedCount} of ${result.total} customers`,
        })
      }
      if (result.failedCount > 0) {
        addToast({
          type: result.invitedCount > 0 ? 'info' : 'error',
          message: `${result.failedCount} invite(s) failed`,
        })
      }
    } catch (err) {
      addToast({ type: 'error', message: `Bulk invite failed: ${(err as Error).message}` })
    } finally {
      setBulkSending(false)
    }
  }

  const credentialsCsv = () => {
    if (!bulkResult) return ''
    const header = 'email,tempPassword\n'
    const body = bulkResult.invited.map((i) => `${i.email},${i.tempPassword}`).join('\n')
    return header + body + '\n'
  }

  const handleCopyCredentials = async () => {
    if (!bulkResult || bulkResult.invited.length === 0) return
    const lines = bulkResult.invited.map((i) => `${i.email},${i.tempPassword}`).join('\n')
    try {
      await navigator.clipboard.writeText(lines)
      addToast({ type: 'success', message: 'Credentials copied to clipboard' })
    } catch {
      addToast({ type: 'error', message: 'Clipboard copy blocked — use Download instead' })
    }
  }

  const handleDownloadCredentials = () => {
    if (!bulkResult || bulkResult.invited.length === 0) return
    const stamp = new Date().toISOString().slice(0, 10)
    downloadFile(`apx-invited-customers-${stamp}.csv`, credentialsCsv())
  }

  const handleDownloadTemplate = () => {
    downloadFile('apx-customers-template.csv', SAMPLE_CSV)
  }

  const stats = {
    total: customers.length,
    invited: customers.filter((c) => deriveStatus(c) === 'invited').length,
    active: customers.filter((c) => deriveStatus(c) === 'active').length,
    voted: customers.filter((c) => deriveStatus(c) === 'voted').length,
  }

  const validCount = parsedRows.filter((r) => r.valid).length
  const invalidCount = parsedRows.length - validCount

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
        onClose={handleCloseBulk}
        title="Bulk Customer Import"
        size="xl"
      >
        {!bulkResult ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-text-muted">
                Upload a CSV with columns: <code className="text-text">email, company, votingDeadline</code> (YYYY-MM-DD, optional). Header row is auto-detected. Maximum 100 rows per batch.
              </p>
              <Button
                variant="secondary"
                size="sm"
                icon={<FileDown className="w-4 h-4" />}
                onClick={handleDownloadTemplate}
              >
                Download template
              </Button>
            </div>

            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-accent/30 transition-colors">
              <Upload className="w-8 h-8 mx-auto mb-3 text-text-muted" />
              <p className="text-sm text-text-muted mb-2">
                {fileName ? `Selected: ${fileName}` : 'Choose a CSV file to preview'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                id="csv-upload"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleFileSelected(f)
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                {fileName ? 'Choose different file' : 'Choose file'}
              </Button>
            </div>

            {parsedRows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-text">
                    {parsedRows.length} row(s) parsed
                  </span>
                  <span className="text-success">{validCount} valid</span>
                  {invalidCount > 0 && (
                    <span className="text-error">{invalidCount} invalid</span>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto border border-border rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-2 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-text-muted uppercase">#</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-text-muted uppercase">Email</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-text-muted uppercase">Company</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-text-muted uppercase">Deadline</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-text-muted uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((row, idx) => (
                        <tr
                          key={idx}
                          className={`border-t border-border ${row.valid ? '' : 'bg-error/5'}`}
                        >
                          <td className="px-3 py-2 text-text-muted">{idx + 1}</td>
                          <td className={`px-3 py-2 ${row.valid ? 'text-text' : 'text-error'}`}>
                            {row.email || <span className="italic opacity-60">(empty)</span>}
                          </td>
                          <td className={`px-3 py-2 ${row.valid ? 'text-text' : 'text-error'}`}>
                            {row.company || <span className="italic opacity-60">(empty)</span>}
                          </td>
                          <td className="px-3 py-2 text-text-muted">{row.votingDeadline || '-'}</td>
                          <td className="px-3 py-2">
                            {row.valid ? (
                              <span className="inline-flex items-center gap-1 text-success text-xs">
                                <CheckCircle className="w-3.5 h-3.5" /> OK
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-error text-xs">
                                <AlertCircle className="w-3.5 h-3.5" /> {row.reason}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={handleCloseBulk}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSendBulk}
                disabled={validCount === 0 || bulkSending}
              >
                {bulkSending
                  ? `Sending ${validCount}...`
                  : `Send ${validCount} invite${validCount === 1 ? '' : 's'}`}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="glass rounded-xl p-4">
                <p className="text-xs text-text-muted mb-1">Total</p>
                <p className="text-2xl font-semibold text-text">{bulkResult.total}</p>
              </div>
              <div className="glass rounded-xl p-4">
                <p className="text-xs text-text-muted mb-1">Invited</p>
                <p className="text-2xl font-semibold text-success">{bulkResult.invitedCount}</p>
              </div>
              <div className="glass rounded-xl p-4">
                <p className="text-xs text-text-muted mb-1">Failed</p>
                <p className="text-2xl font-semibold text-error">{bulkResult.failedCount}</p>
              </div>
            </div>

            {bulkResult.invited.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-text">Temporary credentials</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Copy className="w-3.5 h-3.5" />}
                      onClick={handleCopyCredentials}
                    >
                      Copy
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<FileDown className="w-3.5 h-3.5" />}
                      onClick={handleDownloadCredentials}
                    >
                      Download CSV
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-text-muted">
                  Share these passwords securely. They are not stored server-side and cannot be retrieved later.
                </p>
                <div className="max-h-60 overflow-y-auto border border-border rounded-xl">
                  <table className="w-full text-sm font-mono">
                    <thead className="bg-surface-2 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-text-muted uppercase">Email</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-text-muted uppercase">Temp Password</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkResult.invited.map((row, idx) => (
                        <tr key={idx} className="border-t border-border">
                          <td className="px-3 py-2 text-text">{row.email}</td>
                          <td className="px-3 py-2 text-text">{row.tempPassword}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {bulkResult.failed.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-error flex items-center gap-2">
                  <X className="w-4 h-4" /> Failed rows
                </h3>
                <div className="max-h-60 overflow-y-auto border border-error/30 rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="bg-error/10 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-error uppercase">Email</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-error uppercase">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkResult.failed.map((row, idx) => (
                        <tr key={idx} className="border-t border-error/20">
                          <td className="px-3 py-2 text-text">{row.email}</td>
                          <td className="px-3 py-2 text-error">{row.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={resetBulkState}>
                Upload another
              </Button>
              <Button variant="primary" onClick={handleCloseBulk}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  )
}

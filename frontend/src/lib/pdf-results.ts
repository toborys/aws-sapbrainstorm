import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { AggregatedIdeaResult, PilotListEntry } from '../types'

interface ResultsPdfInput {
  ideas: AggregatedIdeaResult[]
  pilotList: PilotListEntry[]
  totalVotes: number
  uniqueVoters: number
  generatedAt?: string
}

export function downloadResultsPdf(input: ResultsPdfInput): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40
  let y = margin

  // Header
  doc.setFillColor(74, 158, 255)
  doc.rect(0, 0, pageWidth, 80, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('APX Innovation Platform', margin, 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.text('Voting Results Report', margin, 60)
  y = 110

  // Metadata row
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(9)
  const ts = new Date(input.generatedAt || Date.now()).toLocaleString('en-US')
  doc.text(`Generated: ${ts}`, margin, y)
  doc.text(`Total votes: ${input.totalVotes}`, pageWidth / 2, y)
  doc.text(`Unique voters: ${input.uniqueVoters}`, pageWidth - margin, y, { align: 'right' })
  y += 25

  // Section 1: Ranked results
  doc.setTextColor(20, 20, 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Weighted Ranking', margin, y)
  y += 15

  const sorted = [...input.ideas].sort(
    (a, b) => (b.weightedScore ?? 0) - (a.weightedScore ?? 0),
  )
  autoTable(doc, {
    startY: y,
    head: [['Rank', 'Idea', 'Category', 'Votes', 'Score', 'Avg WTP', 'Pilots']],
    body: sorted.map((idea, idx) => [
      String(idx + 1),
      idea.title || idea.ideaId,
      idea.category || '-',
      String(idea.voteCount ?? 0),
      (idea.weightedScore ?? 0).toFixed(2),
      idea.averageWtp != null ? `${idea.averageWtp.toFixed(0)} EUR` : '-',
      String(idea.pilotInterest ?? 0),
    ]),
    headStyles: { fillColor: [42, 42, 62], textColor: [255, 255, 255], fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    margin: { left: margin, right: margin },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 25

  // Section 2: Pilot list
  if (input.pilotList.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 150) {
      doc.addPage()
      y = margin
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(20, 20, 20)
    doc.text(`Pilot Programme Opt-Ins (${input.pilotList.length})`, margin, y)
    y += 15

    autoTable(doc, {
      startY: y,
      head: [['Email', 'Idea', 'Rank', 'WTP Band']],
      body: input.pilotList.map((p) => [
        p.email,
        p.ideaName,
        String(p.rank ?? ''),
        p.wtpBand || '-',
      ]),
      headStyles: { fillColor: [167, 139, 250], textColor: [255, 255, 255], fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      margin: { left: margin, right: margin },
    })
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `APX Innovation Platform - Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: 'center' },
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  doc.save(`apx-voting-results-${today}.pdf`)
}

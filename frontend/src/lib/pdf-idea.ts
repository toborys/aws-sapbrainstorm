import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Idea } from '../types'

type Rgb = [number, number, number]

export function downloadIdeaPdf(idea: Idea): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40
  const textWidth = pageWidth - 2 * margin
  let y = margin

  // Helper: add text with word wrap; returns new y
  const addText = (
    text: string,
    opts: { size?: number; bold?: boolean; color?: Rgb; spaceAfter?: number; italic?: boolean } = {},
  ) => {
    const { size = 10, bold = false, color = [20, 20, 20] as Rgb, spaceAfter = 8, italic = false } = opts
    const style = bold ? (italic ? 'bolditalic' : 'bold') : italic ? 'italic' : 'normal'
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(color[0], color[1], color[2])
    const lines = doc.splitTextToSize(text || '-', textWidth) as string[]
    // page break
    if (y + lines.length * (size * 1.2) > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
    doc.text(lines, margin, y)
    y += lines.length * (size * 1.2) + spaceAfter
  }

  const addSection = (title: string) => {
    if (y + 30 > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
    doc.setDrawColor(74, 158, 255)
    doc.setLineWidth(2)
    doc.line(margin, y, margin + 30, y)
    y += 10
    addText(title, { size: 14, bold: true, spaceAfter: 10 })
  }

  // Cover header
  doc.setFillColor(42, 42, 62)
  doc.rect(0, 0, pageWidth, 100, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('APX - ' + (idea.category || 'Idea'), margin, 35)
  doc.setFontSize(22)
  const titleLines = doc.splitTextToSize(idea.name || 'Untitled idea', textWidth) as string[]
  doc.text(titleLines, margin, 60)
  if (idea.tagline) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(11)
    doc.setTextColor(74, 158, 255)
    const taglineLines = doc.splitTextToSize(idea.tagline, textWidth) as string[]
    doc.text(taglineLines, margin, 90)
  }
  y = 130

  // Problem
  addSection('Problem')
  addText(idea.problem || 'Not specified.')

  // Solution
  addSection('Solution')
  addText(idea.solution || 'Not specified.')

  // Target customer
  addSection('Target Customer')
  addText(idea.targetBuyer || 'To be defined.')
  if (idea.customerPerspective) {
    addText(`"${idea.customerPerspective}"`, { color: [100, 100, 150], size: 10, italic: true })
  }

  // Differentiator
  if (idea.differentiator) {
    addSection('Differentiator')
    addText(idea.differentiator)
  }

  // Technical
  addSection('Technical Profile')
  const awsServices = (idea.awsServices || []).join(', ') || '-'
  const sapModules = (idea.sapModules || []).join(', ') || '-'
  autoTable(doc, {
    startY: y,
    head: [['Field', 'Value']],
    body: [
      ['AWS Services', awsServices],
      ['SAP Modules', sapModules],
      ['Complexity', idea.complexity || '-'],
      ['MVP Time', idea.mvpTime || '-'],
      ['Risk', idea.risk || '-'],
      ['Risk Note', idea.riskNote || '-'],
    ],
    headStyles: { fillColor: [42, 42, 62], textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 100, fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    margin: { left: margin, right: margin },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 15

  // Economics
  addSection('Economics')
  const costDev = idea.costEstimate?.devEur
  const costProd = idea.costEstimate?.prodEur
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: [
      ['Estimated MRR', idea.mrr || '-'],
      ['Pricing Model', idea.model || '-'],
      ['Self-service', idea.selfService ? 'Yes' : 'No'],
      ['Potential', idea.potential || '-'],
      ['Est. dev infra cost', costDev != null ? `${costDev} EUR/month` : '-'],
      ['Est. prod infra cost', costProd != null ? `${costProd} EUR/month` : '-'],
    ],
    headStyles: { fillColor: [52, 211, 153], textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 160, fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [245, 250, 245] },
    margin: { left: margin, right: margin },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 15
  if (idea.costEstimate?.assumptions) {
    addText(`Assumptions: ${idea.costEstimate.assumptions}`, { size: 8, color: [100, 100, 100] })
  }

  // Architecture (text only - mermaid diagram would require headless rendering)
  if (idea.architecture) {
    addSection('Architecture')
    addText(idea.architecture)
  }
  if (idea.architectureDiagram) {
    addText('Architecture Diagram (Mermaid source):', {
      size: 9,
      bold: true,
      color: [100, 100, 100],
    })
    doc.setFont('courier', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(80, 80, 80)
    const diagramLines = doc.splitTextToSize(idea.architectureDiagram, textWidth) as string[]
    if (y + diagramLines.length * 9 > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
    doc.text(diagramLines, margin, y)
    y += diagramLines.length * 9 + 15
  }

  // Advisory Panel
  if (idea.championedBy?.length || idea.challengedBy?.length || idea.panelNotes) {
    addSection('Advisory Panel')
    if (idea.championedBy?.length) {
      addText(`Championed by: ${idea.championedBy.join(', ')}`, {
        size: 10,
        color: [52, 150, 100],
      })
    }
    if (idea.challengedBy?.length) {
      addText(`Concerns raised by: ${idea.challengedBy.join(', ')}`, {
        size: 10,
        color: [200, 80, 80],
      })
    }
    if (idea.panelNotes) {
      addText(idea.panelNotes, { size: 10, color: [80, 80, 80] })
    }
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `APX Innovation Platform - ${idea.name} - Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 20,
      { align: 'center' },
    )
  }

  const safeName = (idea.name || 'idea')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  doc.save(`apx-idea-${safeName}.pdf`)
}

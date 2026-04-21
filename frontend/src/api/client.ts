import { useAuthStore } from '../stores/authStore'
import type { Idea, VotingSession, CustomIdea, VoteResults, UserProfile, BrainstormRequest } from '../types'

const API_BASE = import.meta.env.VITE_API_URL || ''

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || `Request failed: ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

// Ideas
export function getIdeas() {
  return request<Idea[]>('/api/ideas')
}

export function getIdea(id: string) {
  return request<Idea>(`/api/ideas/${id}`)
}

export function createIdea(data: Partial<Idea>) {
  return request<Idea>('/api/ideas', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateIdea(id: string, data: Partial<Idea>) {
  return request<Idea>(`/api/ideas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteIdea(id: string) {
  return request<void>(`/api/ideas/${id}`, {
    method: 'DELETE',
  })
}

export function reorderIdeas(orderedIds: string[]) {
  return request<void>('/api/ideas/reorder', {
    method: 'PUT',
    body: JSON.stringify({ orderedIds }),
  })
}

// Voting
export function submitVotes(data: {
  ideaIds: string[];
  customIdea?: string;
  ranking?: string[];
  wtpBand?: string;
  urgency?: string;
  pilotOptIn?: boolean;
  pilotEmail?: string;
}) {
  return request<VotingSession>('/api/votes/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getMyVotes() {
  return request<VotingSession>('/api/votes/my')
}

export function getVoteResults() {
  return request<VoteResults>('/api/votes/results')
}

// Custom Ideas
export function getCustomIdeas() {
  return request<CustomIdea[]>('/api/admin/custom-ideas')
}

export function updateCustomIdea(id: string, data: Partial<CustomIdea>) {
  return request<CustomIdea>(`/api/admin/custom-ideas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// Users / Customers
export function getCustomers() {
  return request<UserProfile[]>('/api/admin/customers')
}

export function inviteCustomer(data: { email: string; company: string; votingDeadline?: string }) {
  return request<UserProfile>('/api/admin/customers/invite', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function bulkInviteCustomers(data: Array<{ email: string; company: string; votingDeadline?: string }>) {
  return request<UserProfile[]>('/api/admin/customers/invite/bulk', {
    method: 'POST',
    body: JSON.stringify({ customers: data }),
  })
}

export function resendInvite(userId: string) {
  return request<void>(`/api/admin/customers/${userId}/resend`, {
    method: 'POST',
  })
}

// Brainstorm
export function startBrainstorm(data: BrainstormRequest & { evolveFromIdeaId?: string }) {
  return request<{ sessionId: string; status: string }>('/api/brainstorm/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getBrainstormStatus(sessionId: string) {
  return request<{
    sessionId: string;
    status: 'generating' | 'complete' | 'error';
    ideas?: unknown[];
    discussion?: string;
    agentCount?: number;
    error?: string;
  }>(`/api/brainstorm/status/${sessionId}`)
}

// Keep old name for backward compat
export const brainstormIdeas = startBrainstorm

export function getBrainstormHistory() {
  return request<Array<{ key: string; lastModified: string }>>('/api/brainstorm/history')
}

export function getKnowledgeBaseStats() {
  return request<{
    totalIdeas: number;
    scanned: number;
    customIdeasCount: number;
    categoryBreakdown: Array<{ category: string; count: number }>;
    last7d: number;
    last30d: number;
    recent: Array<{ id: string; name: string; category: string; savedAt?: string }>;
    generatedAt: string;
  }>('/api/knowledge-base/stats')
}

export function generateBuildKit(ideaId: string) {
  return request<{
    ideaId: string;
    generatedAt: string;
    files: string[];
    presignedUrl: string;
    expiresAt: string;
  }>(`/api/ideas/${ideaId}/build-kit`, {
    method: 'POST',
  })
}

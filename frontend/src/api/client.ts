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
    method: 'POST',
    body: JSON.stringify({ orderedIds }),
  })
}

// Voting
export function submitVotes(data: { votedIdeas: string[]; customIdea?: string }) {
  return request<VotingSession>('/api/votes', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getMyVotes() {
  return request<VotingSession>('/api/votes/me')
}

export function getVoteResults() {
  return request<VoteResults>('/api/votes/results')
}

// Custom Ideas
export function getCustomIdeas() {
  return request<CustomIdea[]>('/api/custom-ideas')
}

export function updateCustomIdea(id: string, data: Partial<CustomIdea>) {
  return request<CustomIdea>(`/api/custom-ideas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// Users / Customers
export function getCustomers() {
  return request<UserProfile[]>('/api/customers')
}

export function inviteCustomer(data: { email: string; company: string; votingDeadline?: string }) {
  return request<UserProfile>('/api/customers/invite', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function bulkInviteCustomers(data: Array<{ email: string; company: string; votingDeadline?: string }>) {
  return request<UserProfile[]>('/api/customers/invite/bulk', {
    method: 'POST',
    body: JSON.stringify({ customers: data }),
  })
}

export function resendInvite(userId: string) {
  return request<void>(`/api/customers/${userId}/resend`, {
    method: 'POST',
  })
}

// Brainstorm
export function brainstormIdeas(data: BrainstormRequest) {
  return request<Partial<Idea>[]>('/api/brainstorm', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

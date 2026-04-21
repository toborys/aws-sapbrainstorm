// Shared types between frontend and backend

export interface Idea {
  id: string;
  name: string;
  tagline: string;
  problem: string;
  solution: string;
  architecture: string;
  complexity: 'low' | 'medium' | 'high';
  mvpTime: string;
  risk: 'low' | 'medium' | 'high';
  riskNote: string;
  mrr: string;
  model: string;
  selfService: boolean;
  potential: 'low' | 'medium' | 'high';
  category: IdeaCategory;
  createdAt: string;
  createdBy: string;
  status: 'active' | 'hidden' | 'archived';
  order: number;
  // --- Extended fields (optional, added post-scaffold) ---
  awsServices?: string[];
  championedBy?: string[];              // agent IDs who championed (real, from diverge stage)
  challengedBy?: string[];              // agent IDs who raised concerns
  panelNotes?: string;                  // consolidated panel discussion
  categoryType?: 'technical' | 'business' | 'sales' | 'operations';
  categoryGroup?: 'technical' | 'business';
  targetBuyer?: string;                 // already ad-hoc in handlers, formalize
  customerPerspective?: string;
  differentiator?: string;
  architectureDiagram?: string;         // raw mermaid source (renders in modal)
  sapModules?: string[];                // ['FI','MM','SD','HANA',...]
  costEstimate?: {
    devEur: number;
    prodEur: number;
    assumptions: string;
  };
  sourceSessionId?: string;             // brainstorm session that produced this idea
  updatedAt?: string;
}

export type IdeaCategory =
  | 'Monitoring & Observability'
  | 'Security & Compliance'
  | 'Automation'
  | 'Migration & Modernization'
  | 'Analytics & Insights'
  | 'Performance Testing'
  | 'Cloud & Infrastructure'
  | 'SAP Solutions'
  | 'AI & Machine Learning'
  | 'Cybersecurity'
  | 'SaaS Products'
  | 'Professional Services'
  | 'Sales & Go-to-Market'
  | 'Customer Success'
  | 'Internal Tools & Automation'
  | 'Data & Analytics';

export interface Vote {
  userId: string;
  ideaId: string;
  votedAt: string;
  userCompany: string;
}

export type WtpBand =
  | 'lt-100'
  | '100-300'
  | '300-800'
  | '800-2000'
  | 'gt-2000'
  | 'wont-pay';

export type UrgencyBand = '0-3m' | '3-12m' | '12m-plus' | 'not-sure';

export interface VotingSession {
  userId: string;
  userEmail: string;
  company: string;
  votedIdeas: string[];
  customIdea?: string;
  submittedAt: string;
  ipAddress: string;
  // --- Extended (WP-19): optional for backward compat with existing rows ---
  ranking?: string[];                                    // ordered idea IDs (index 0 = top preference)
  wtpBand?: WtpBand;
  urgency?: UrgencyBand;
  pilotOptIn?: boolean;
  pilotEmail?: string;                                   // required only if pilotOptIn=true
}

export interface CustomIdea {
  id: string;
  authorId: string;
  authorEmail: string;
  company: string;
  title: string;
  description: string;
  createdAt: string;
  status: 'pending' | 'reviewed' | 'accepted' | 'rejected';
  adminNotes?: string;
}

export interface AggregatedIdeaResult {
  ideaId: string;
  title?: string;
  category?: string;
  voteCount: number;
  weightedScore?: number;
  averageWtp?: number;
  pilotInterest?: number;
  urgencyBreakdown?: {
    '0-3m': number;
    '3-12m': number;
    '12m-plus': number;
    'not-sure': number;
  };
}

export interface PilotListEntry {
  ideaId: string;
  ideaName: string;
  email: string;
  rank: number;
  wtpBand: string;
}

export interface VoteResults {
  lastUpdated?: string;
  votesByIdea: Record<string, number>;
  totalVoters?: number;
  participationRate?: number;
  topIdeas?: string[];
  // --- Extended (WP-21) ---
  totalVotes?: number;
  uniqueVoters?: number;
  ideas?: AggregatedIdeaResult[];
  pilotList?: PilotListEntry[];
  updatedAt?: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  company: string;
  role: 'customer' | 'team-member' | 'team-admin';
  invitedAt: string;
  lastLogin?: string;
  hasVoted: boolean;
  votingDeadline?: string;
}

export interface BrainstormRequest {
  category: IdeaCategory;
  prompt?: string;
  count: number;
  agents?: string[];
  categoryGroup?: string;
}

export interface BrainstormSession {
  id: string;
  category: IdeaCategory;
  prompt: string;
  generatedIdeas: Partial<Idea>[];
  createdAt: string;
  createdBy: string;
}

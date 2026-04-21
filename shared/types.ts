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

export interface VotingSession {
  userId: string;
  userEmail: string;
  company: string;
  votedIdeas: string[];
  customIdea?: string;
  submittedAt: string;
  ipAddress: string;
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

export interface VoteResults {
  lastUpdated: string;
  votesByIdea: Record<string, number>;
  totalVoters: number;
  participationRate: number;
  topIdeas: string[];
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

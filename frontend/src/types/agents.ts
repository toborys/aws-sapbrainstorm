export interface BrainstormAgent {
  id: string;
  name: string;
  role: string;
  avatar: string;
  color: string;
  expertise: string[];
  systemPrompt: string;
  perspective: 'technical' | 'business' | 'customer' | 'strategy';
}

export interface AgentResponse {
  agentId: string;
  agentName: string;
  ideas: GeneratedIdea[];
  commentary: string;
  timestamp: string;
}

export interface GeneratedIdea {
  name: string;
  tagline: string;
  problem: string;
  solution: string;
  architecture: string;
  awsServices: string[];
  complexity: 'low' | 'medium' | 'high';
  mvpTime: string;
  risk: 'low' | 'medium' | 'high';
  riskNote: string;
  mrr: string;
  model: string;
  selfService: boolean;
  potential: 'low' | 'medium' | 'high';
  category: string;
  categoryGroup: 'technical' | 'business';
  categoryType: 'technical' | 'business' | 'sales' | 'operations';
  targetBuyer: string;
  customerPerspective: string;
  differentiator: string;
  championedBy: string[];
  challengedBy: string[];
  panelNotes: string;
  // --- Extended optional fields ---
  architectureDiagram?: string;
  sapModules?: string[];
  costEstimate?: {
    devEur: number;
    prodEur: number;
    assumptions: string;
  };
  sourceSessionId?: string;
}

export interface BrainstormSession {
  id: string;
  agents: BrainstormAgent[];
  category: string;
  prompt: string;
  responses: AgentResponse[];
  createdAt: string;
  status: 'generating' | 'complete' | 'error';
}

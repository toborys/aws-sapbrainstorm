/**
 * Brainstorm Worker — 3-stage multi-agent pipeline.
 *
 * Stage 1 — DIVERGE    : Principal Architect generates N raw candidate ideas.
 * Stage 2 — CRITIQUE   : Product Owner and Devil's Advocate critique in parallel.
 * Stage 3 — CONVERGE   : Synthesis call that merges architect ideas + critiques
 *                        into the final N shippable ideas with deterministic
 *                        championedBy / challengedBy / costEstimate fields.
 *
 * Each stage is a separate Bedrock InvokeModel call, so CloudWatch logs will
 * show at least 4 distinct InvokeModelCommand entries per session
 * (1 diverge + 2 critiques + 1 converge). See README/acceptance notes.
 *
 * Orchestration is intentionally inlined here (no Step Functions) — the single
 * Worker Lambda runs all stages sequentially within its 300s timeout.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { estimateCost } from '../lib/aws-pricing-static.js';

const bedrock = new BedrockRuntimeClient({ region: 'eu-central-1' });
const s3 = new S3Client({ region: 'eu-central-1' });
const DATA_BUCKET = process.env.DATA_BUCKET!;

const MODEL_ID = 'eu.anthropic.claude-sonnet-4-20250514-v1:0';

// -----------------------------------------------------------------------------
// Agent personas
// -----------------------------------------------------------------------------

const AGENT_PERSONAS: Record<string, { name: string; role: string; prompt: string }> = {
  'principal-architect': {
    name: 'Principal Architect AWS+SAP',
    role: 'Lead Idea Generator',
    prompt:
      'I am a Principal Architect with 20+ years of combined SAP and AWS experience. I generate ideas that are TECHNICALLY BUILDABLE and COMMERCIALLY RELEVANT. Every idea I produce includes: (1) specific AWS services with production-grade justification (Well-Architected pillars, cost tier, EU data residency); (2) explicit SAP module mapping (FI/CO/MM/SD/PP/HCM/HANA/BTP) and integration pattern (RFC, OData, IDoc, CPI iFlow, BTP Event Mesh, Datasphere); (3) a concrete architecture described as a Mermaid flowchart with real service nodes; (4) deployment complexity in weeks, not months; (5) awareness of existing AWS Solutions Library patterns, SAP Activate methodology, and RISE vs Grow constraints. I do not produce vague "AI-powered" ideas — I produce buildable ones with a named first customer profile.',
  },
  'product-owner': {
    name: 'Product Owner',
    role: 'Implementation Guardian',
    prompt:
      'I am a certified Product Owner (PSPO II / SAFe PO-PM). For every idea the Architect proposes I enforce implementation discipline: I decompose it into a "first shippable increment" deliverable in 4-6 weeks with named user stories and acceptance criteria, I separate MVP scope from V1 and V2 in explicit Now/Next/Later columns, I surface non-functional requirements (performance budgets, SLAs, security controls, observability) that the Architect may have glossed over, and I map dependencies on existing SAP/AWS platform capabilities. I kill scope creep. If an idea cannot produce a demo-able vertical slice in 6 weeks, I reject it or force the Architect to re-scope. My output is always actionable — a team could start work tomorrow.',
  },
  'devils-advocate': {
    name: "Devil's Advocate",
    role: 'Brutal Business Validator',
    prompt:
      'I am the Devil\'s Advocate. For every idea proposed I run a brutal real-world check: (1) Who already builds this? I name specific competitors from AWS Marketplace, SAP Store, Avantra, Basis Technologies, ServiceNow, Datadog, Dynatrace, and relevant startups — with product names. (2) Will SAP or AWS kill this with a native feature? I cite specific roadmap signals (SAP Build, AWS Solutions Library, Systems Manager for SAP, AWS AppFabric for SAP). (3) Is the TAM worth the build effort? I challenge MRR claims with CAC and sales-cycle reality for SAP mid-market. (4) What are the real implementation blockers — security review timelines, data residency (GDPR Art. 44+), SAP licensing (indirect access), regulatory (DORA, NIS2)? (5) Can a solo operator realistically sell, support, and scale this? I end every assessment with a one-word verdict — GO, PIVOT, or KILL — followed by a single sentence that defends the verdict and, if PIVOT, names the specific reframing. I am not here to be nice. I am here to make sure we do not burn six months building something the market does not want.',
  },
};

const COMPANY_CONTEXT =
  'APX is an IT company specializing in SAP and AWS (AWS Advanced Consulting Partner). We build SaaS products, managed services, and consulting solutions. Core expertise: SAP Basis/HANA/S4, AWS cloud, AI/ML, infrastructure. Target: mid-market/enterprise (100-5000 employees). Goal: recurring revenue products (MRR 500-5000 EUR/month). Competitive advantage: deep SAP + AWS + AI expertise.';

const CATEGORIES = [
  'Cloud & Infrastructure',
  'SAP Solutions',
  'AI & Machine Learning',
  'Cybersecurity',
  'SaaS Products',
  'Professional Services',
  'Sales & Go-to-Market',
  'Customer Success',
  'Internal Tools & Automation',
  'Data & Analytics',
];

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface BrainstormEvent {
  sessionId: string;
  userId: string;
  category: string;
  categoryGroup: string;
  prompt: string | null;
  count: number;
  agents: string[];
}

interface RawIdea {
  name: string;
  tagline: string;
  category: string;
  categoryType?: 'technical' | 'business' | 'sales' | 'operations';
  problem: string;
  solution: string;
  architecture?: string;
  architectureDiagram?: string;
  awsServices?: string[];
  sapModules?: string[];
  complexity?: 'low' | 'medium' | 'high';
  mvpTime?: string;
  risk?: 'low' | 'medium' | 'high';
  riskNote?: string;
  mrr?: string;
  model?: string;
  selfService?: boolean;
  potential?: 'low' | 'medium' | 'high';
  targetBuyer?: string;
  customerPerspective?: string;
  differentiator?: string;
}

interface DivergeOutput {
  ideas: RawIdea[];
  architectCommentary: string;
}

interface PoCritique {
  ideaRef: number;
  implementationNotes: string;
  rejected: boolean;
}

interface DaCritique {
  ideaRef: number;
  competitors: string[];
  platformRisk: string;
  verdict: 'GO' | 'PIVOT' | 'KILL';
  verdictDefense: string;
  concerns: string[];
  pivotSuggestion?: string;
}

interface FinalIdea extends RawIdea {
  championedBy: string[];
  challengedBy: string[];
  panelNotes: string;
  costEstimate: { devEur: number; prodEur: number; assumptions: string };
}

// -----------------------------------------------------------------------------
// Mermaid validation
// -----------------------------------------------------------------------------

function isValidMermaid(src: string | undefined | null): boolean {
  if (!src || typeof src !== 'string') return false;
  const trimmed = src.trim();
  if (trimmed.length < 20) return false;
  // Must start with flowchart/graph directive + direction
  if (!/^(flowchart|graph)\s+(TD|LR|BT|RL|TB)/.test(trimmed)) return false;
  // Rough balanced-bracket check
  const opens = (trimmed.match(/\[/g) || []).length;
  const closes = (trimmed.match(/\]/g) || []).length;
  if (opens !== closes) return false;
  // Must contain at least one arrow
  if (!/-->/.test(trimmed)) return false;
  return true;
}

function fallbackDiagram(name: string): string {
  const safeName = (name || 'Idea').replace(/[\[\]]/g, '');
  return `flowchart TD\n  User([User]) --> App[${safeName}]\n  App --> AWS[AWS Services]`;
}

// -----------------------------------------------------------------------------
// Bedrock helpers
// -----------------------------------------------------------------------------

interface InvokeParams {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
}

/**
 * Invoke Claude on Bedrock with exponential-backoff retry on throttling.
 * Returns the raw text content (caller parses as JSON).
 */
async function invokeWithRetry(params: InvokeParams, maxRetries = 3): Promise<string> {
  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: params.maxTokens,
    system: params.systemPrompt,
    messages: [{ role: 'user', content: params.userPrompt }],
  });

  let lastErr: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await bedrock.send(
        new InvokeModelCommand({
          modelId: MODEL_ID,
          contentType: 'application/json',
          accept: 'application/json',
          body: new TextEncoder().encode(body),
        }),
      );
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const rawText: string =
        responseBody.content?.find((c: { type: string }) => c.type === 'text')?.text || '';
      return rawText;
    } catch (err: unknown) {
      lastErr = err;
      const name = (err as { name?: string })?.name || '';
      const retriable = name === 'ThrottlingException' || name === 'ServiceUnavailableException';
      if (retriable && i < maxRetries - 1) {
        const delay = 2000 * Math.pow(2, i);
        console.warn(`[bedrock] ${name} — retrying in ${delay}ms (attempt ${i + 2}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Strip markdown fences (```json ... ```) from Claude's response and parse.
 * Returns `null` on parse failure (caller decides fallback).
 */
function extractJson<T>(rawText: string): T | null {
  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  // Try direct parse first
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall back to extracting the first {...} block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        /* fall through */
      }
    }
    console.error('[brainstorm-worker] JSON parse failed. First 300 chars:', cleaned.slice(0, 300));
    return null;
  }
}

// -----------------------------------------------------------------------------
// S3 session-status helper
// -----------------------------------------------------------------------------

interface SessionStatusExtra {
  stage?: 'diverge' | 'critique' | 'converge';
  completedAgents?: string[];
  ideas?: unknown[];
  discussion?: string;
  agentCount?: number;
  error?: string;
  [key: string]: unknown;
}

async function updateSessionStatus(
  sessionId: string,
  userId: string,
  event: BrainstormEvent,
  status: 'generating' | 'diverging' | 'critiquing' | 'converging' | 'complete' | 'error',
  extra: SessionStatusExtra = {},
): Promise<void> {
  const payload = {
    sessionId,
    userId,
    status,
    category: event.category,
    categoryGroup: event.categoryGroup,
    prompt: event.prompt,
    count: event.count,
    agents: event.agents,
    ideas: extra.ideas ?? [],
    discussion: extra.discussion ?? '',
    agentCount: extra.agentCount ?? 3,
    stage: extra.stage,
    completedAgents: extra.completedAgents ?? [],
    error: extra.error,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...extra,
  };

  await s3.send(
    new PutObjectCommand({
      Bucket: DATA_BUCKET,
      Key: `brainstorm/${sessionId}.json`,
      Body: JSON.stringify(payload),
      ContentType: 'application/json',
    }),
  );
}

// -----------------------------------------------------------------------------
// Stage 1 — Diverge
// -----------------------------------------------------------------------------

async function runDiverge(
  category: string,
  categoryGroup: string,
  userContext: string | null,
  count: number,
): Promise<DivergeOutput> {
  const architect = AGENT_PERSONAS['principal-architect'];

  const systemPrompt = `You are the ${architect.name} (${architect.role}).

${architect.prompt}

${COMPANY_CONTEXT}

You are in the DIVERGE stage of a multi-agent brainstorm. Your job: produce raw candidate ideas that will then be critiqued by a Product Owner and a Devil's Advocate. Favor concreteness over caution — generate more specific, buildable candidates than you think you need. Output valid JSON only.`;

  let userPrompt = '';
  if (category && category !== 'all') userPrompt += `Focus category: ${category}\n`;
  if (categoryGroup && categoryGroup !== 'all') userPrompt += `Type: ${categoryGroup}\n`;
  if (userContext) userPrompt += `Additional context: ${userContext}\n`;

  // We ask for 25% extra so the Devil's Advocate can KILL some without leaving
  // us under-supplied at the converge stage.
  const targetCount = Math.max(count + 2, Math.ceil(count * 1.25));

  userPrompt += `\nGenerate exactly ${targetCount} raw candidate product ideas for APX. Categories to choose from: ${CATEGORIES.join(', ')}.

For EACH idea provide:
- name, tagline (one sentence)
- category (must be one of the list above), categoryType ('technical'|'business'|'sales'|'operations')
- problem (2-3 sentences of real pain)
- solution (2-3 sentences)
- architecture (short paragraph describing the tech architecture)
- architectureDiagram: a Mermaid flowchart, as a STRING. MUST start with "flowchart TD" (or LR). Use real AWS/SAP service nodes. Use --> arrows. Keep it under 15 nodes. Example: "flowchart TD\\n  U([User]) --> API[API Gateway]\\n  API --> L[Lambda]\\n  L --> DDB[(DynamoDB)]"
- awsServices: array of specific AWS service names (e.g. ["Lambda","API Gateway","DynamoDB","Bedrock"])
- sapModules: array of SAP modules touched (e.g. ["FI","HANA","BTP"])
- complexity: 'low' | 'medium' | 'high'
- mvpTime: e.g. "6 weeks"
- risk: 'low' | 'medium' | 'high'
- riskNote: biggest single risk in one sentence
- targetBuyer: title + company profile of the first buyer

Also provide an architectCommentary string (3-5 sentences) explaining the theme and the top 2 ideas you're most confident in.

Return ONLY valid JSON, no markdown:
{"ideas":[{...}], "architectCommentary":"..."}`;

  console.log(`[diverge] requesting ${targetCount} raw ideas (final target ${count})`);
  const raw = await invokeWithRetry({ systemPrompt, userPrompt, maxTokens: 8000 });
  const parsed = extractJson<DivergeOutput>(raw);
  if (!parsed || !Array.isArray(parsed.ideas) || parsed.ideas.length === 0) {
    throw new Error('Diverge stage produced no parseable ideas');
  }
  console.log(`[diverge] got ${parsed.ideas.length} raw ideas`);
  return parsed;
}

// -----------------------------------------------------------------------------
// Stage 2 — Critique (PO and DA in parallel)
// -----------------------------------------------------------------------------

function ideasAsNumberedList(ideas: RawIdea[]): string {
  return ideas
    .map((idea, i) => {
      const svcs = (idea.awsServices || []).join(', ');
      return `[${i}] ${idea.name} — ${idea.tagline}
   Problem: ${idea.problem}
   Solution: ${idea.solution}
   AWS: ${svcs || 'n/a'}
   SAP: ${(idea.sapModules || []).join(', ') || 'n/a'}
   MVP: ${idea.mvpTime || 'n/a'} | complexity: ${idea.complexity || 'n/a'} | target: ${idea.targetBuyer || 'n/a'}`;
    })
    .join('\n\n');
}

async function runCritiquePO(ideas: RawIdea[]): Promise<PoCritique[]> {
  const po = AGENT_PERSONAS['product-owner'];
  const systemPrompt = `You are the ${po.name} (${po.role}).

${po.prompt}

${COMPANY_CONTEXT}

You are in the CRITIQUE stage. You will review raw candidate ideas produced by a Principal Architect. Your job is IMPLEMENTATION DISCIPLINE — user stories, acceptance criteria, NFRs, time-to-first-ship. Output valid JSON only.`;

  const userPrompt = `Review each idea below and produce a critique focused on IMPLEMENTATION.

For EACH idea provide:
- ideaRef: the number in brackets [0], [1], ...
- implementationNotes: 4-6 sentences covering:
  * MVP scope in explicit Now / Next / Later phases
  * 3-5 concrete user stories ("As a <role> I can <action> so that <outcome>")
  * acceptance criteria for the MVP
  * NFRs (latency budget, SLA, security controls, observability)
  * dependencies on existing SAP/AWS capabilities
  * time-to-first-ship in weeks
- rejected: boolean — set to TRUE only if the idea cannot ship a vertical slice in 6 weeks

Ideas to review:
${ideasAsNumberedList(ideas)}

Return ONLY valid JSON, no markdown:
{"critiques":[{"ideaRef":0,"implementationNotes":"...","rejected":false}, ...]}`;

  console.log(`[critique-po] critiquing ${ideas.length} ideas`);
  const raw = await invokeWithRetry({ systemPrompt, userPrompt, maxTokens: 6000 });
  const parsed = extractJson<{ critiques: PoCritique[] }>(raw);
  if (!parsed || !Array.isArray(parsed.critiques)) {
    console.warn('[critique-po] parse failed — returning empty critiques');
    return [];
  }
  return parsed.critiques;
}

async function runCritiqueDA(ideas: RawIdea[]): Promise<DaCritique[]> {
  const da = AGENT_PERSONAS['devils-advocate'];
  const systemPrompt = `You are the ${da.name} (${da.role}).

${da.prompt}

${COMPANY_CONTEXT}

You are in the CRITIQUE stage. You will review raw candidate ideas produced by a Principal Architect. Your job is BRUTAL BUSINESS VALIDATION — competitors, platform risk, TAM reality, regulatory blockers, verdict. Output valid JSON only.`;

  const userPrompt = `For each idea below run your brutal real-world check.

For EACH idea provide:
- ideaRef: the number in brackets [0], [1], ...
- competitors: array of specific product/company names (AWS Marketplace, SAP Store, Avantra, Basis Technologies, ServiceNow, Datadog, Dynatrace, relevant startups). 2-5 names.
- platformRisk: one sentence — will SAP or AWS kill this with a native feature? Cite the specific roadmap signal (SAP Build, AWS Solutions Library, Systems Manager for SAP, AWS AppFabric for SAP, etc.).
- verdict: exactly "GO" or "PIVOT" or "KILL"
- verdictDefense: one sentence defending the verdict.
- concerns: array of 2-4 short concern bullets (TAM, CAC, security review, data residency, DORA/NIS2/GDPR, SAP indirect access licensing).
- pivotSuggestion: if verdict === "PIVOT", a one-sentence reframing (new name or new target buyer). Otherwise empty string.

Ideas to review:
${ideasAsNumberedList(ideas)}

Return ONLY valid JSON, no markdown:
{"critiques":[{"ideaRef":0,"competitors":[...],"platformRisk":"...","verdict":"GO","verdictDefense":"...","concerns":[...],"pivotSuggestion":""}, ...]}`;

  console.log(`[critique-da] critiquing ${ideas.length} ideas`);
  const raw = await invokeWithRetry({ systemPrompt, userPrompt, maxTokens: 6000 });
  const parsed = extractJson<{ critiques: DaCritique[] }>(raw);
  if (!parsed || !Array.isArray(parsed.critiques)) {
    console.warn('[critique-da] parse failed — returning empty critiques');
    return [];
  }
  return parsed.critiques;
}

// -----------------------------------------------------------------------------
// Stage 3 — Converge
// -----------------------------------------------------------------------------

interface ConvergeResponseIdea {
  ideaRef: number;
  name: string;
  tagline: string;
  category: string;
  categoryType?: 'technical' | 'business' | 'sales' | 'operations';
  problem: string;
  solution: string;
  architecture?: string;
  awsServices?: string[];
  sapModules?: string[];
  complexity?: 'low' | 'medium' | 'high';
  mvpTime?: string;
  risk?: 'low' | 'medium' | 'high';
  riskNote?: string;
  mrr?: string;
  model?: string;
  selfService?: boolean;
  potential?: 'low' | 'medium' | 'high';
  targetBuyer?: string;
  customerPerspective?: string;
  differentiator?: string;
  panelNotes?: string;
}

interface ConvergeResponse {
  ideas: ConvergeResponseIdea[];
  discussion: string;
}

function critiqueSummary(
  ideas: RawIdea[],
  po: PoCritique[],
  da: DaCritique[],
): string {
  const lines: string[] = [];
  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i];
    const pc = po.find((c) => c.ideaRef === i);
    const dc = da.find((c) => c.ideaRef === i);
    lines.push(`[${i}] ${idea.name}`);
    if (pc) {
      lines.push(`  PO ${pc.rejected ? 'REJECTED' : 'OK'}: ${pc.implementationNotes}`);
    } else {
      lines.push(`  PO: (no critique)`);
    }
    if (dc) {
      const pivot = dc.verdict === 'PIVOT' && dc.pivotSuggestion ? ` Pivot: ${dc.pivotSuggestion}` : '';
      lines.push(
        `  DA ${dc.verdict}: ${dc.verdictDefense} Competitors: ${(dc.competitors || []).join(', ')}. Platform risk: ${dc.platformRisk}. Concerns: ${(dc.concerns || []).join('; ')}.${pivot}`,
      );
    } else {
      lines.push(`  DA: (no critique)`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function runConverge(
  diverge: DivergeOutput,
  po: PoCritique[],
  da: DaCritique[],
  count: number,
): Promise<ConvergeResponse> {
  const survivingIdeas = diverge.ideas
    .map((idea, i) => ({ idea, i, daVerdict: da.find((c) => c.ideaRef === i)?.verdict }))
    .filter((x) => x.daVerdict !== 'KILL');

  const killed = diverge.ideas.length - survivingIdeas.length;

  const systemPrompt = `You facilitate the CONVERGE stage of a multi-agent brainstorm at APX.

${COMPANY_CONTEXT}

Three experts worked on this session:
1. Principal Architect — generated the raw candidate ideas (DIVERGE stage)
2. Product Owner — critiqued implementation discipline
3. Devil's Advocate — validated against the market

Your job is synthesis: merge the architect's ideas with both critiques into the final ${count} ideas. Do not invent new ideas — only select and refine from the architect's list. Output valid JSON only.`;

  const userPrompt = `ARCHITECT COMMENTARY:
${diverge.architectCommentary}

RAW IDEAS (numbered):
${ideasAsNumberedList(diverge.ideas)}

PO + DA CRITIQUES:
${critiqueSummary(diverge.ideas, po, da)}

INSTRUCTIONS:
1. Select up to ${count} ideas. SKIP any idea where the DA verdict is KILL. ${killed > 0 ? `(${killed} idea${killed === 1 ? ' was' : 's were'} already killed by DA.)` : ''}
2. If DA verdict is PIVOT, apply the pivot: adjust the name / solution / target buyer to reflect the pivotSuggestion.
3. Keep the architect's problem and solution statements largely intact — you are NOT the generator, you are the synthesizer.
4. Preserve the ideaRef number from the raw list so we can match back to the architect's original architectureDiagram.
5. Merge PO implementation notes + DA concerns summary into the panelNotes field (5-8 sentences).
6. Fill in: mrr (est. MRR at 12 months, e.g. "2500 EUR/mo"), model (pricing model, e.g. "per-tenant subscription"), selfService (boolean), potential ('low'|'medium'|'high'), customerPerspective (one sentence on why the buyer buys), differentiator (one sentence on unique edge).
7. If fewer than ${count} ideas survive, return what's left (do NOT pad with weak ideas).

Also produce a session-level discussion field (3-5 sentences) summarising:
- what the Architect proposed as a theme
- the Product Owner's main implementation theme
- the Devil's Advocate's main business theme
- what got killed or pivoted and why

For each selected idea include ALL of these fields:
ideaRef (number from the raw list), name, tagline, category, categoryType, problem, solution, architecture, awsServices (array), sapModules (array), complexity, mvpTime, risk, riskNote, mrr, model, selfService, potential, targetBuyer, customerPerspective, differentiator, panelNotes.

Do NOT include architectureDiagram, championedBy, challengedBy, or costEstimate — those are set server-side.

Return ONLY valid JSON, no markdown:
{"ideas":[{...}], "discussion":"..."}`;

  console.log(`[converge] synthesizing up to ${count} final ideas from ${survivingIdeas.length} survivors`);
  const raw = await invokeWithRetry({ systemPrompt, userPrompt, maxTokens: 16000 });
  const parsed = extractJson<ConvergeResponse>(raw);
  if (!parsed || !Array.isArray(parsed.ideas)) {
    throw new Error('Converge stage produced no parseable ideas');
  }
  console.log(`[converge] got ${parsed.ideas.length} final ideas`);
  return parsed;
}

// -----------------------------------------------------------------------------
// Assembly: apply deterministic server-side fields
// -----------------------------------------------------------------------------

function assembleFinalIdeas(
  converge: ConvergeResponse,
  diverge: DivergeOutput,
  po: PoCritique[],
  da: DaCritique[],
): FinalIdea[] {
  const final: FinalIdea[] = [];

  for (const cIdea of converge.ideas) {
    const ref = typeof cIdea.ideaRef === 'number' ? cIdea.ideaRef : -1;
    const rawIdea = ref >= 0 && ref < diverge.ideas.length ? diverge.ideas[ref] : undefined;

    // Architecture diagram — always from architect, never regenerated.
    let diagram = rawIdea?.architectureDiagram;
    if (!isValidMermaid(diagram)) {
      console.warn(
        `[mermaid] invalid diagram for "${cIdea.name}" — using fallback (was: ${(diagram || '').slice(0, 80)})`,
      );
      diagram = fallbackDiagram(cIdea.name);
    }

    // championedBy: principal-architect always (he generated the idea)
    const championedBy = ['principal-architect'];

    // challengedBy: DA if verdict != GO; PO if rejected
    const challengedBy: string[] = [];
    const daForIdea = ref >= 0 ? da.find((c) => c.ideaRef === ref) : undefined;
    const poForIdea = ref >= 0 ? po.find((c) => c.ideaRef === ref) : undefined;
    if (daForIdea && daForIdea.verdict !== 'GO') challengedBy.push('devils-advocate');
    if (poForIdea?.rejected) challengedBy.push('product-owner');

    // costEstimate: deterministic from static table, overwrites any model output
    const awsServices = cIdea.awsServices || rawIdea?.awsServices || [];
    const costEstimate = estimateCost(awsServices);

    // panelNotes: prefer what Claude merged, but fall back to concatenating
    // raw critiques if empty.
    let panelNotes = cIdea.panelNotes || '';
    if (!panelNotes) {
      const parts: string[] = [];
      if (poForIdea) parts.push(`PO: ${poForIdea.implementationNotes}`);
      if (daForIdea) {
        parts.push(
          `DA (${daForIdea.verdict}): ${daForIdea.verdictDefense} Concerns: ${(daForIdea.concerns || []).join('; ')}.`,
        );
      }
      panelNotes = parts.join(' ');
    }

    final.push({
      name: cIdea.name,
      tagline: cIdea.tagline,
      category: cIdea.category,
      categoryType: cIdea.categoryType,
      problem: cIdea.problem,
      solution: cIdea.solution,
      architecture: cIdea.architecture || rawIdea?.architecture,
      architectureDiagram: diagram,
      awsServices,
      sapModules: cIdea.sapModules || rawIdea?.sapModules || [],
      complexity: cIdea.complexity || rawIdea?.complexity,
      mvpTime: cIdea.mvpTime || rawIdea?.mvpTime,
      risk: cIdea.risk || rawIdea?.risk,
      riskNote: cIdea.riskNote || rawIdea?.riskNote,
      mrr: cIdea.mrr,
      model: cIdea.model,
      selfService: cIdea.selfService,
      potential: cIdea.potential,
      targetBuyer: cIdea.targetBuyer || rawIdea?.targetBuyer,
      customerPerspective: cIdea.customerPerspective,
      differentiator: cIdea.differentiator,
      championedBy,
      challengedBy,
      panelNotes,
      costEstimate,
    });
  }

  return final;
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------

export const handler = async (event: BrainstormEvent) => {
  const { sessionId, userId, category, categoryGroup, prompt, count } = event;
  const startedAt = Date.now();
  console.log(`[worker] session=${sessionId} count=${count} category=${category}`);

  try {
    // -------- Stage 1: Diverge --------------------------------------------
    await updateSessionStatus(sessionId, userId, event, 'diverging', {
      stage: 'diverge',
      completedAgents: [],
      agentCount: 3,
    });

    const diverge = await runDiverge(category, categoryGroup, prompt, count);

    // -------- Stage 2: Critique (parallel) --------------------------------
    await updateSessionStatus(sessionId, userId, event, 'critiquing', {
      stage: 'critique',
      completedAgents: ['principal-architect'],
      agentCount: 3,
    });

    const [poCritiques, daCritiques] = await Promise.all([
      runCritiquePO(diverge.ideas),
      runCritiqueDA(diverge.ideas),
    ]);

    // -------- Stage 3: Converge ------------------------------------------
    await updateSessionStatus(sessionId, userId, event, 'converging', {
      stage: 'converge',
      completedAgents: ['principal-architect', 'product-owner', 'devils-advocate'],
      agentCount: 3,
    });

    const converge = await runConverge(diverge, poCritiques, daCritiques, count);
    const finalIdeas = assembleFinalIdeas(converge, diverge, poCritiques, daCritiques);

    // Trim to requested count (converge may have returned slightly more/fewer)
    const trimmed = finalIdeas.slice(0, count);

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[worker] done session=${sessionId} final=${trimmed.length} elapsed=${elapsedMs}ms`,
    );

    // -------- Save complete -----------------------------------------------
    await s3.send(
      new PutObjectCommand({
        Bucket: DATA_BUCKET,
        Key: `brainstorm/${sessionId}.json`,
        Body: JSON.stringify({
          sessionId,
          userId,
          status: 'complete',
          stage: 'complete',
          completedAgents: ['principal-architect', 'product-owner', 'devils-advocate'],
          category,
          categoryGroup,
          prompt,
          count,
          agents: event.agents,
          ideas: trimmed,
          discussion: converge.discussion || diverge.architectCommentary || '',
          agentCount: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          elapsedMs,
        }),
        ContentType: 'application/json',
      }),
    );

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('[worker] error', err);

    await s3.send(
      new PutObjectCommand({
        Bucket: DATA_BUCKET,
        Key: `brainstorm/${sessionId}.json`,
        Body: JSON.stringify({
          sessionId,
          userId,
          status: 'error',
          error: (err as Error).message,
          category,
          categoryGroup,
          prompt,
          count,
          agents: event.agents,
          ideas: [],
          discussion: '',
          agentCount: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        ContentType: 'application/json',
      }),
    );

    throw err;
  }
};

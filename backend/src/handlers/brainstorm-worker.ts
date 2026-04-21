import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const bedrock = new BedrockRuntimeClient({ region: 'eu-central-1' });
const s3 = new S3Client({ region: 'eu-central-1' });
const DATA_BUCKET = process.env.DATA_BUCKET!;

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

const COMPANY_CONTEXT = `APX is an IT company specializing in SAP and AWS (AWS Advanced Consulting Partner). We build SaaS products, managed services, and consulting solutions. Core expertise: SAP Basis/HANA/S4, AWS cloud, AI/ML, infrastructure. Target: mid-market/enterprise (100-5000 employees). Goal: recurring revenue products (MRR 500-5000 EUR/month). Competitive advantage: deep SAP + AWS + AI expertise.`;

const CATEGORIES = [
  'Cloud & Infrastructure', 'SAP Solutions', 'AI & Machine Learning', 'Cybersecurity',
  'SaaS Products', 'Professional Services', 'Sales & Go-to-Market', 'Customer Success',
  'Internal Tools & Automation', 'Data & Analytics',
];

interface BrainstormEvent {
  sessionId: string;
  userId: string;
  category: string;
  categoryGroup: string;
  prompt: string | null;
  count: number;
  agents: string[];
}

export const handler = async (event: BrainstormEvent) => {
  const { sessionId, category, categoryGroup, prompt, count, agents: agentIds } = event;

  try {
    const selectedAgents = (agentIds.length > 0 ? agentIds : Object.keys(AGENT_PERSONAS))
      .map((id) => ({ id, ...AGENT_PERSONAS[id] }))
      .filter((a) => a.name);

    const agentDescriptions = selectedAgents
      .map((a, i) => `${i + 1}. ${a.name} (${a.role}): ${a.prompt}`)
      .join('\n');

    const systemPrompt = `You facilitate a strategic brainstorm at APX. ${selectedAgents.length} experts collaborate to produce exactly ${count} unique, client-ready product ideas.

${COMPANY_CONTEXT}

EXPERTS:
${agentDescriptions}

RULES: Experts DEBATE and CONVERGE on ${count} best ideas. No duplicates. Each idea must be actionable, with specific metrics. Output must be professional enough to present to enterprise clients.`;

    let userPrompt = '';
    if (category && category !== 'all') userPrompt += `Focus: ${category}\n`;
    if (categoryGroup && categoryGroup !== 'all') userPrompt += `Type: ${categoryGroup}\n`;
    if (prompt) userPrompt += `Context: ${prompt}\n`;

    userPrompt += `\nGenerate exactly ${count} ideas. Categories: ${CATEGORIES.join(', ')}

Return ONLY JSON (no markdown):
{"ideas":[{"name":"Name","tagline":"One sentence","category":"Category","categoryType":"technical|business|sales|operations","problem":"Pain point (2-3 sentences)","solution":"How it works (2-3 sentences)","architecture":"Tech architecture","awsServices":["Service1"],"complexity":"low|medium|high","mvpTime":"e.g. 6 weeks","risk":"low|medium|high","riskNote":"Biggest risk","mrr":"Est. MRR after 12M","model":"Pricing model","selfService":true,"potential":"low|medium|high","targetBuyer":"Who buys","customerPerspective":"Why they buy","differentiator":"What makes it unique","championedBy":["agent-id"],"challengedBy":["agent-id"],"panelNotes":"Discussion summary"}],"discussion":"3-5 sentence session summary"}`;

    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const response = await bedrock.send(
      new InvokeModelCommand({
        modelId: 'eu.anthropic.claude-sonnet-4-20250514-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: new TextEncoder().encode(body),
      }),
    );

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const rawText = responseBody.content?.find((c: { type: string }) => c.type === 'text')?.text || '';
    const cleanedText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed: { ideas: unknown[]; discussion: string };
    try {
      parsed = JSON.parse(cleanedText);
    } catch {
      console.error('Parse failed:', cleanedText.slice(0, 300));
      parsed = { ideas: [], discussion: 'Failed to parse AI response' };
    }

    // Save completed session
    await s3.send(
      new PutObjectCommand({
        Bucket: DATA_BUCKET,
        Key: `brainstorm/${sessionId}.json`,
        Body: JSON.stringify({
          sessionId,
          userId: event.userId,
          status: 'complete',
          category,
          categoryGroup,
          prompt,
          count,
          agents: agentIds,
          ideas: parsed.ideas || [],
          discussion: parsed.discussion || '',
          agentCount: selectedAgents.length,
          createdAt: new Date().toISOString(),
        }),
        ContentType: 'application/json',
      }),
    );

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('brainstorm-worker error', err);

    // Save error status
    await s3.send(
      new PutObjectCommand({
        Bucket: DATA_BUCKET,
        Key: `brainstorm/${sessionId}.json`,
        Body: JSON.stringify({
          sessionId,
          userId: event.userId,
          status: 'error',
          error: (err as Error).message,
          createdAt: new Date().toISOString(),
        }),
        ContentType: 'application/json',
      }),
    );

    throw err;
  }
};

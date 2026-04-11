import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const bedrock = new BedrockRuntimeClient({ region: 'eu-central-1' });
const s3 = new S3Client({ region: 'eu-central-1' });
const DATA_BUCKET = process.env.DATA_BUCKET!;

const AGENT_PERSONAS: Record<string, { name: string; role: string; prompt: string }> = {
  'ceo-visionary': {
    name: 'CEO / Visionary',
    role: 'Wizjoner produktowy',
    prompt: 'As a confident tech CEO, I evaluate market opportunities with a founder\'s conviction. I focus on: 10x value propositions, market timing, defensible position, path to $1M ARR in 18 months.',
  },
  'head-of-sales': {
    name: 'Head of Sales',
    role: 'Dyrektor sprzedazy B2B',
    prompt: 'As a B2B sales leader, every idea must pass my "30-second pitch test". I evaluate: who signs the PO, sales cycle, deal size vs. CAC, self-service trial potential.',
  },
  'product-strategist': {
    name: 'Product Strategist',
    role: 'Strateg produktowy SaaS',
    prompt: 'As a SaaS strategist, I quantify everything: TAM/SAM/SOM, LTV/CAC ratios (target 3:1+), Net Revenue Retention (target 120%+), competitive moat, PLG mechanics.',
  },
  'devils-advocate': {
    name: "Devil's Advocate",
    role: 'Krytyk',
    prompt: "I stress-test every idea against market reality. I identify: fatal flaws, hidden competitors, regulatory landmines, platform risk. When I find weakness, I propose a pivot.",
  },
  'sap-architect': {
    name: 'SAP Architect',
    role: 'Architekt SAP',
    prompt: 'Senior SAP architect with 15+ years across Basis, HANA, S/4HANA. I evaluate technical feasibility with precision: integration patterns, deployment complexity, implementation timelines.',
  },
  'aws-architect': {
    name: 'AWS Architect',
    role: 'Solutions Architect AWS',
    prompt: 'Principal AWS SA. I design production-ready architectures: Well-Architected, serverless-first, with monthly cost estimates and DR design.',
  },
  'infra-expert': {
    name: 'Infrastructure Expert',
    role: 'Ekspert infrastruktury',
    prompt: 'Infrastructure expert bridging on-premise and cloud. I design hybrid environments with specific network, storage, DR/HA configurations and cost comparisons.',
  },
  'genai-aws': {
    name: 'GenAI on AWS',
    role: 'Specjalista GenAI/Bedrock',
    prompt: 'Enterprise GenAI specialist. Expert in Bedrock, SageMaker, RAG. I provide model recommendations with cost-per-query, accuracy benchmarks, and efficiency metrics.',
  },
  'ai-onprem': {
    name: 'AI/ML On-Prem',
    role: 'Ekspert AI on-premise',
    prompt: 'Private AI specialist for enterprises that cannot use public cloud. Expert in Ollama, vLLM, NVIDIA GPUs. I provide hardware BOM, throughput benchmarks, TCO analysis.',
  },
  'sap-customer': {
    name: 'Enterprise Customer',
    role: 'Glos klienta',
    prompt: 'CTO of a 500-person company with $2M IT budget. I evaluate through procurement lens: 90-day time-to-value, security review, team adoption, 3x better than current tools.',
  },
  'security-expert': {
    name: 'Security & Compliance',
    role: 'Ekspert bezpieczenstwa',
    prompt: 'CISSP security architect. I evaluate through zero-trust lens: data classification, GDPR/SOX/ISO 27001, threat models, audit-ready compliance.',
  },
  'growth-hacker': {
    name: 'Growth Hacker',
    role: 'Specjalista wzrostu',
    prompt: 'B2B growth specialist. I design acquisition engines: content funnels, freemium conversion (target 5-8%), partnership channels, community-led growth with 90-day sprint KPIs.',
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

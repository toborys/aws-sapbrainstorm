// Build-kit template library (WP-13).
//
// Given an Idea, render a set of files that form the "Implementation Handoff"
// package: PRD, CLAUDE.md project brief, architecture diagram, CDK scaffold
// and README. These files are then zipped and uploaded to S3 by the
// ideas-build-kit handler (WP-14).

import { estimateCost, type CostEstimate } from './aws-pricing-static.js';

// Local structural type for build-kit rendering. Keeps backend self-contained
// (avoids importing across the monorepo rootDir boundary) while still matching
// shared/types.ts → Idea.
export interface Idea {
  id: string;
  name: string;
  tagline?: string;
  problem?: string;
  solution?: string;
  architecture?: string;
  complexity?: string;
  mvpTime?: string;
  risk?: string;
  riskNote?: string;
  mrr?: string;
  model?: string;
  category?: string;
  awsServices?: string[];
  sapModules?: string[];
  targetBuyer?: string;
  customerPerspective?: string;
  differentiator?: string;
  architectureDiagram?: string;
  championedBy?: string[];
  challengedBy?: string[];
  panelNotes?: string;
  sourceSessionId?: string;
  costEstimate?: {
    devEur: number;
    prodEur: number;
    assumptions: string;
  };
}

export interface BuildKitFile {
  /** Relative path inside the zip, e.g. 'PRD.md' or 'cdk-skeleton/lib/stack.ts'. */
  path: string;
  content: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function kebabCase(s: string): string {
  return (s || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project';
}

export function pascalCase(s: string): string {
  const parts = (s || 'project').split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length === 0) return 'Project';
  return parts
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('');
}

/** Whitelist of AWS services we know how to scaffold as CDK constructs. */
const CDK_WHITELIST = new Set([
  'Lambda',
  'AWS Lambda',
  'DynamoDB',
  'S3',
  'API Gateway',
  'API Gateway HTTP',
  'CloudFront',
  'Cognito',
]);

function generateConstructsFromAwsServices(awsServices: string[]): string {
  const seen = new Set<string>();
  const blocks: string[] = [];

  for (const raw of awsServices || []) {
    if (!raw || typeof raw !== 'string') continue;
    const service = raw.trim();
    if (!service) continue;

    // Normalise some common aliases so we don't emit duplicates.
    const canonical = canonicalise(service);
    if (seen.has(canonical)) continue;
    seen.add(canonical);

    if (!CDK_WHITELIST.has(service) && !CDK_WHITELIST.has(canonical)) {
      blocks.push(`    // TODO: ${service} — not in build-kit whitelist, add manually`);
      continue;
    }

    switch (canonical) {
      case 'Lambda':
        blocks.push(
`    // Lambda
    const handlerFn = new lambda.Function(this, 'HandlerFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
      timeout: cdk.Duration.seconds(10),
    });`);
        break;
      case 'DynamoDB':
        blocks.push(
`    // DynamoDB
    const table = new dynamodb.Table(this, 'MainTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });`);
        break;
      case 'S3':
        blocks.push(
`    // S3
    const bucket = new s3.Bucket(this, 'DataBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });`);
        break;
      case 'API Gateway':
        blocks.push(
`    // API Gateway (HTTP API)
    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: '${pascalCase('app')}Api',
    });`);
        break;
      case 'CloudFront':
        blocks.push(
`    // CloudFront distribution — wire origin below
    // const distribution = new cloudfront.Distribution(this, 'Distribution', {
    //   defaultBehavior: {
    //     origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
    //     viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    //   },
    // });`);
        break;
      case 'Cognito':
        blocks.push(
`    // Cognito UserPool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
    });`);
        break;
    }
  }

  if (blocks.length === 0) {
    blocks.push('    // No services from the idea match the build-kit whitelist.');
  }
  return blocks.join('\n\n');
}

function canonicalise(service: string): string {
  const s = service.trim();
  if (s === 'AWS Lambda') return 'Lambda';
  if (s === 'API Gateway HTTP') return 'API Gateway';
  return s;
}

function detectIntegrationMechanisms(architecture: string): string {
  const hits = (architecture || '').match(/RFC|OData|IDoc|CPI|BTP|Event Mesh|Datasphere/gi);
  if (!hits || hits.length === 0) {
    return 'read-only file system / standard exports';
  }
  // Dedupe while preserving order (case-insensitive).
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const h of hits) {
    const k = h.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      uniq.push(h);
    }
  }
  return uniq.join(', ');
}

function normaliseCostEstimate(idea: Idea): CostEstimate {
  if (idea.costEstimate && typeof idea.costEstimate.devEur === 'number') {
    return {
      devEur: idea.costEstimate.devEur,
      prodEur: idea.costEstimate.prodEur,
      assumptions: idea.costEstimate.assumptions || 'Stored estimate.',
    };
  }
  return estimateCost(idea.awsServices || []);
}

// ─── Main entry point ─────────────────────────────────────────────────────

export function renderBuildKit(idea: Idea, sourceSessionIdArg?: string): BuildKitFile[] {
  const generatedAt = new Date().toISOString();

  const name = idea.name || 'Untitled Idea';
  const tagline = idea.tagline || '';
  const category = idea.category || 'Uncategorised';
  const problem = idea.problem || 'TBD';
  const solution = idea.solution || 'TBD';
  const targetBuyer = idea.targetBuyer || '';
  const customerPerspective = idea.customerPerspective || '';
  const differentiator = idea.differentiator || '';
  const awsServices = idea.awsServices || [];
  const sapModules = idea.sapModules || [];
  const architecture = idea.architecture || '';
  const architectureDiagram = idea.architectureDiagram || '';
  const complexity = idea.complexity || 'medium';
  const mvpTime = idea.mvpTime || 'TBD';
  const risk = idea.risk || 'medium';
  const riskNote = idea.riskNote || '';
  const mrr = idea.mrr || 'TBD';
  const model = idea.model || 'TBD';
  const championedBy = idea.championedBy || [];
  const challengedBy = idea.challengedBy || [];
  const panelNotes = idea.panelNotes || '';
  const sourceSessionId = sourceSessionIdArg || idea.sourceSessionId || '';
  const costEstimate = normaliseCostEstimate(idea);

  const kebab = kebabCase(name);
  const pascal = pascalCase(name);

  // ─── PRD.md ────────────────────────────────────────────────────────────
  const prd = `# Product Requirements Document: ${name}

> ${tagline}
>
> **Category:** ${category} &middot; **Status:** Discovery &middot; **Source:** APX Advisory Panel session ${sourceSessionId || 'n/a'}
> **Generated:** ${generatedAt}

---

## 1. Problem

${problem}

## 2. Solution

${solution}

## 3. Target Customer

${targetBuyer || 'TBD'}

> "${customerPerspective || 'TBD'}"

## 4. Differentiator

${differentiator || 'TBD'}

## 5. Technical Scope

### AWS Services (${awsServices.length})
${awsServices.map(s => `- ${s}`).join('\n') || '- TBD'}

### SAP Modules (${sapModules.length})
${sapModules.map(m => `- ${m}`).join('\n') || '- TBD'}

### Architecture

See \`mermaid.md\` for the visual flowchart.

Summary:
${architecture || 'See diagram.'}

## 6. Economics

- **Complexity:** ${complexity}
- **MVP time:** ${mvpTime}
- **Risk:** ${risk}
- **Risk note:** ${riskNote || 'n/a'}
- **Estimated MRR:** ${mrr}
- **Pricing model:** ${model}

### Estimated AWS monthly cost (eu-central-1, list prices)

| Environment | EUR/month |
|---|---|
| Dev/Test | ${costEstimate.devEur} |
| Production (10 customers) | ${costEstimate.prodEur} |

Assumptions: ${costEstimate.assumptions}

## 7. Advisory Panel Input

### Championed by
${championedBy.map(a => `- ${a}`).join('\n') || '- n/a'}

### Concerns raised by
${challengedBy.map(a => `- ${a}`).join('\n') || '- none'}

### Panel notes

${panelNotes || 'n/a'}

## 8. Next Steps

- [ ] Validate assumptions with first customer interview
- [ ] Confirm cost estimate with AWS Pricing Calculator
- [ ] Sign-off on MVP scope (Product Owner)
- [ ] Create CDK project from scaffold (see \`cdk-skeleton/\`)
- [ ] Set up CI/CD pipeline
- [ ] Customer pilot kickoff

---

*Generated by APX Innovation Platform build-kit.*
`;

  // ─── CLAUDE.md ─────────────────────────────────────────────────────────
  const claudeMd = `# CLAUDE.md

> This file is loaded automatically by Claude Code when working in this repo.
> It provides product context, architectural constraints, and coding conventions.

## Project Intent

${name} — ${tagline}

${problem}

**Solution:** ${solution}

## Target Customer

${targetBuyer || 'TBD'} — ${customerPerspective || 'TBD'}

## Non-Negotiable Constraints

- **EU data residency:** all customer data stays in eu-central-1. No cross-region replication outside EU. No Bedrock models outside EU inference profiles.
- **AWS-native preferred:** use Bedrock over external LLM APIs; use Cognito over custom auth; use DynamoDB over self-hosted DBs where feasible.
- **Serverless-first:** Lambda + DynamoDB + API Gateway as defaults. Containerize only when serverless limits are hit.
- **SAP integration:** via ${detectIntegrationMechanisms(architecture)} — no invasive agents that require SAP privileged auth.
- **Cost envelope:** target MVP monthly infra cost below ${costEstimate.devEur * 2} EUR; production at 10 customers below ${Math.round(costEstimate.prodEur * 1.3)} EUR.

## AWS Services in Scope

${awsServices.map(s => `- ${s}`).join('\n') || '- TBD'}

## SAP Modules in Scope

${sapModules.map(m => `- ${m}`).join('\n') || '- TBD'}

## Complexity & Timeline

- Complexity: ${complexity}
- MVP target: ${mvpTime}
- Biggest risk: ${riskNote || 'n/a'}

## Coding Conventions

- TypeScript strict mode, ESM modules
- React 18, Zustand for state, Tailwind CSS
- AWS CDK v2 (TypeScript) for infrastructure
- One feature = one PR = one CDK deploy
- Tests before merging to main
- No console.log in production code — use structured logger

## Architecture Discipline

- All ideas must round-trip through the APX Innovation Platform before implementation
- Vote-validated (customer confirmed demand) before Tier-1 effort
- Every component must have: a named owner, an SLA, a cost estimate
- Every new AWS service added must be in the pricing table (\`backend/src/lib/aws-pricing-static.ts\`)

## Useful Commands

\`\`\`bash
# Local dev
cd frontend && npm run dev
cd backend && npm run build && npm test

# Deploy to staging
cd infrastructure && npx cdk deploy --profile apx-staging

# Tail logs
aws logs tail /aws/lambda/<function-name> --follow --profile apx-staging
\`\`\`

---

*Original idea proposed by APX Advisory Panel (${championedBy.join(', ') || 'panel'}).*
*Concerns raised by: ${challengedBy.join(', ') || 'none'}.*
*Source session: ${sourceSessionId || 'n/a'}.*
`;

  // ─── mermaid.md ────────────────────────────────────────────────────────
  const mermaidDiagram = architectureDiagram || `flowchart TD\n  User([User]) --> App[${name}]\n  App --> AWS[AWS Services]`;
  const mermaid = `# Architecture Diagram: ${name}

\`\`\`mermaid
${mermaidDiagram}
\`\`\`

---

*Render this file in any Mermaid-compatible viewer (GitHub, VS Code mermaid extension, mermaid.live).*
`;

  // ─── cdk-skeleton/package.json ────────────────────────────────────────
  const cdkPackage = `{
  "name": "${kebab}-infrastructure",
  "version": "0.1.0",
  "bin": { "app": "bin/app.js" },
  "scripts": {
    "build": "tsc",
    "watch": "tsc -w",
    "test": "jest",
    "cdk": "cdk"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "aws-cdk": "^2.160.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.5.0"
  },
  "dependencies": {
    "aws-cdk-lib": "^2.160.0",
    "constructs": "^10.0.0"
  }
}
`;

  // ─── cdk-skeleton/bin/app.ts ──────────────────────────────────────────
  const cdkApp = `#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ${pascal}Stack } from '../lib/stack';

const app = new cdk.App();
new ${pascal}Stack(app, '${pascal}Stack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'eu-central-1',
  },
  description: '${tagline.replace(/'/g, "\\'")}',
});
`;

  // ─── cdk-skeleton/lib/stack.ts ────────────────────────────────────────
  const cdkStack = `import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cognito from 'aws-cdk-lib/aws-cognito';

/**
 * ${name}
 * ${tagline}
 *
 * Scaffolded by APX Innovation Platform on ${generatedAt}.
 * Source idea: ${sourceSessionId || 'n/a'}
 */
export class ${pascal}Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Generated resources below are starting points. Review and adapt.

${generateConstructsFromAwsServices(awsServices)}

    // TODO: wire integrations, add IAM policies, set up CloudWatch alarms
  }
}
`;

  // ─── cdk-skeleton/tsconfig.json ───────────────────────────────────────
  const cdkTsconfig = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["es2022"],
    "declaration": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": false,
    "inlineSourceMap": true,
    "inlineSources": true,
    "experimentalDecorators": true,
    "strictPropertyInitialization": false,
    "typeRoots": ["./node_modules/@types"]
  },
  "exclude": ["cdk.out"]
}
`;

  // ─── cdk-skeleton/cdk.json ────────────────────────────────────────────
  const cdkJson = `{
  "app": "npx ts-node --prefer-ts-exts bin/app.ts",
  "watch": { "include": ["**"], "exclude": ["README.md", "cdk*.json", "**/*.d.ts", "**/*.js", "tsconfig.json", "package*.json", "yarn.lock", "node_modules", "test"] },
  "context": {}
}
`;

  // ─── README.md ────────────────────────────────────────────────────────
  const readme = `# ${name}

> ${tagline}

**Category:** ${category}
**Scaffolded:** ${generatedAt}
**Source idea:** ${sourceSessionId || 'n/a'}

## Getting Started

1. Read \`PRD.md\` for the product requirements.
2. Read \`CLAUDE.md\` — load it in Claude Code to get project context.
3. Review \`mermaid.md\` for the architecture.
4. Check \`cdk-skeleton/\` for a starter CDK stack.

## Build Commands

\`\`\`bash
cd cdk-skeleton
npm install
npx cdk synth
\`\`\`

## Deploy

\`\`\`bash
cd cdk-skeleton
npx cdk deploy --profile <your-aws-profile>
\`\`\`

## Structure

- \`PRD.md\` — product requirements, advisory panel output, economics
- \`CLAUDE.md\` — Claude Code project brief (non-negotiable constraints)
- \`mermaid.md\` — architecture diagram in Mermaid
- \`cdk-skeleton/\` — starter CDK stack with named resources
- \`README.md\` — this file

---

*Built with APX Innovation Platform.*
`;

  return [
    { path: 'PRD.md', content: prd },
    { path: 'CLAUDE.md', content: claudeMd },
    { path: 'mermaid.md', content: mermaid },
    { path: 'README.md', content: readme },
    { path: 'cdk-skeleton/package.json', content: cdkPackage },
    { path: 'cdk-skeleton/bin/app.ts', content: cdkApp },
    { path: 'cdk-skeleton/lib/stack.ts', content: cdkStack },
    { path: 'cdk-skeleton/tsconfig.json', content: cdkTsconfig },
    { path: 'cdk-skeleton/cdk.json', content: cdkJson },
  ];
}

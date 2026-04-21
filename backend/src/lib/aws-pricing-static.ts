// Static AWS pricing table for idea-level cost estimation.
//
// EUR/month estimates at mid-2025 list prices, eu-central-1.
//   devTier  = small dev/test usage (single environment, low volume)
//   prodTier = production at ~10 customers / 100-500 users total
//
// These are ORDER-OF-MAGNITUDE figures used to quickly evaluate ideas during
// brainstorming. They are deliberately NOT dynamic (no Pricing API calls) so
// the brainstorm pipeline stays fast and deterministic. They are NOT quotes.
//
// Keys are matched case-sensitively against the `awsServices` array that the
// Principal Architect produces. We accept a few common variants (e.g. plain
// `Lambda` and `AWS Lambda`, or `API Gateway` and `API Gateway HTTP`).

export const PRICE_EUR_MONTH: Record<string, { devEur: number; prodEur: number }> = {
  // Compute
  Lambda: { devEur: 2, prodEur: 30 },
  'AWS Lambda': { devEur: 2, prodEur: 30 },
  'API Gateway': { devEur: 1, prodEur: 15 },
  'API Gateway HTTP': { devEur: 1, prodEur: 10 },
  ECS: { devEur: 10, prodEur: 80 },
  'ECS Fargate': { devEur: 15, prodEur: 120 },
  EC2: { devEur: 20, prodEur: 150 },
  'Step Functions': { devEur: 1, prodEur: 20 },
  EventBridge: { devEur: 1, prodEur: 5 },

  // Storage
  S3: { devEur: 2, prodEur: 25 },
  EFS: { devEur: 5, prodEur: 60 },
  EBS: { devEur: 3, prodEur: 30 },
  Glacier: { devEur: 0, prodEur: 5 },

  // Database
  DynamoDB: { devEur: 2, prodEur: 40 },
  RDS: { devEur: 30, prodEur: 200 },
  Aurora: { devEur: 40, prodEur: 350 },
  Redshift: { devEur: 100, prodEur: 400 },
  OpenSearch: { devEur: 50, prodEur: 300 },
  'OpenSearch Serverless': { devEur: 40, prodEur: 250 },
  Neptune: { devEur: 60, prodEur: 400 },
  Timestream: { devEur: 10, prodEur: 80 },

  // Integration / messaging
  Kinesis: { devEur: 5, prodEur: 50 },
  'Kinesis Data Streams': { devEur: 5, prodEur: 50 },
  'Kinesis Firehose': { devEur: 3, prodEur: 30 },
  SNS: { devEur: 0, prodEur: 5 },
  SQS: { devEur: 0, prodEur: 5 },
  SES: { devEur: 0, prodEur: 3 },

  // CDN + network
  CloudFront: { devEur: 1, prodEur: 20 },
  'Route 53': { devEur: 1, prodEur: 5 },

  // ML / AI
  Bedrock: { devEur: 20, prodEur: 200 },
  SageMaker: { devEur: 50, prodEur: 400 },
  Comprehend: { devEur: 5, prodEur: 50 },
  Textract: { devEur: 10, prodEur: 80 },

  // Security
  Cognito: { devEur: 0, prodEur: 15 },
  'Secrets Manager': { devEur: 1, prodEur: 5 },
  KMS: { devEur: 1, prodEur: 5 },
  WAF: { devEur: 5, prodEur: 30 },

  // Data / analytics
  Glue: { devEur: 10, prodEur: 100 },
  Athena: { devEur: 2, prodEur: 50 },
  QuickSight: { devEur: 15, prodEur: 120 },
  'Lake Formation': { devEur: 5, prodEur: 30 },

  // Monitoring
  CloudWatch: { devEur: 2, prodEur: 30 },
  'X-Ray': { devEur: 1, prodEur: 15 },

  // Dev / Ops
  'Systems Manager': { devEur: 0, prodEur: 10 },
  CloudTrail: { devEur: 0, prodEur: 5 },
};

export interface CostEstimate {
  devEur: number;
  prodEur: number;
  assumptions: string;
}

/**
 * Sum dev/prod EUR estimates for a list of AWS services.
 * Unknown services are skipped (and listed in the assumptions string so the
 * reader knows the number is a lower bound).
 */
export function estimateCost(services: string[]): CostEstimate {
  let dev = 0;
  let prod = 0;
  const known: string[] = [];
  const unknown: string[] = [];

  for (const svc of services || []) {
    if (!svc || typeof svc !== 'string') continue;
    const normalized = svc.trim();
    if (!normalized) continue;
    const entry = PRICE_EUR_MONTH[normalized];
    if (entry) {
      dev += entry.devEur;
      prod += entry.prodEur;
      known.push(normalized);
    } else {
      unknown.push(normalized);
    }
  }

  const parts = [
    `Based on ${known.length} known service${known.length === 1 ? '' : 's'}`,
    unknown.length > 0
      ? `${unknown.length} unrecognized service${unknown.length === 1 ? '' : 's'} not priced (${unknown
          .slice(0, 3)
          .join(', ')}${unknown.length > 3 ? '...' : ''})`
      : '',
    'mid-2025 eu-central-1 list prices',
    'prodTier assumes ~10 customers, 100-500 users',
  ].filter(Boolean);

  return {
    devEur: Math.round(dev),
    prodEur: Math.round(prod),
    assumptions: parts.join('; ') + '.',
  };
}

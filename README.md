# SAP Innovation Platform

Internal platform for managing and evaluating SAP product innovation ideas, built on AWS serverless architecture.

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite, Tailwind CSS, deployed via CloudFront + S3
- **Backend:** AWS Lambda (Node.js 20), API Gateway, DynamoDB
- **Auth:** Amazon Cognito (dual pool: customer + team)
- **AI:** Anthropic Claude via Amazon Bedrock
- **Infrastructure:** AWS CDK (TypeScript)
- **CI/CD:** GitHub Actions (staging + production)

## Project Structure

```
frontend/          React SPA
backend/           Lambda handlers and scripts
infrastructure/    CDK stacks
shared/            Shared types and utilities
data/              Seed data (ideas.json)
```

## Getting Started

### Prerequisites

- Node.js 20+
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)

### Installation

```bash
# Install dependencies for all packages
cd infrastructure && npm install
cd ../frontend && npm install
cd ../backend && npm install
```

### Local Development

```bash
# Frontend dev server
cd frontend && npm run dev

# Build backend
cd backend && npm run build
```

### Deploy Infrastructure

```bash
cd infrastructure
npx cdk deploy -c env=staging    # staging
npx cdk deploy -c env=production # production
```

### Seed Data

```bash
cd backend
npm run seed -- --env=staging
```

## CI/CD

- Push to `develop` branch deploys to **staging**
- Push to `main` branch deploys to **production**

Both pipelines use OIDC-based AWS authentication (no stored access keys).

# CLAUDE CODE PROMPT — SAP Innovation Platform

> Skopiuj ten prompt w całości do Claude Code w VS Code i uruchom.
> Zakłada: Node.js 20+, AWS CLI skonfigurowane, CDK zainstalowane, repo na GitHub.

---

## KONTEKST PROJEKTU

Budujesz **SAP Innovation Platform** — aplikację SaaS z dwoma portalami:

1. **Portal Klienta** (`/vote`) — zaproszeni klienci SAP logują się, przeglądają 20 pomysłów na produkty, głosują na 5 które są dla nich najbardziej wartościowe i mogą zgłosić własny pomysł. Celem jest walidacja rynkowa i identyfikacja pierwszych klientów do pilotażu.

2. **Portal Zespołu** (`/team`) — wewnętrzny dashboard dla zespołu technicznego: generowanie nowych pomysłów produktowych z pomocą AI (Claude API), zarządzanie bazą pomysłów (CRUD), podgląd wyników głosowania w czasie rzeczywistym, zarządzanie kontami klientów.

Docelowa infrastruktura: **AWS-native, serverless, EU (Frankfurt eu-central-1)**.
CI/CD: **GitHub Actions → AWS CDK**.

---

## STOS TECHNOLOGICZNY

### Frontend
- **React 18** + TypeScript + Vite
- **Tailwind CSS** (tylko utility classes, bez custom CSS)
- **React Router v6** (SPA, client-side routing)
- **Zustand** (state management)
- **AWS Amplify JS v6** (Auth + API calls)
- **Recharts** (wykresy wyników głosowania)
- **Lucide React** (ikony)

### Backend (Serverless)
- **AWS Lambda** (Node.js 20, ESM modules)
- **API Gateway HTTP API** (nie REST API — tańszy, szybszy)
- **Amazon Cognito** — dwa User Pools:
  - `CustomerPool` — klienci SAP (zapraszani przez admina, no self-signup)
  - `TeamPool` — zespół wewnętrzny
- **Amazon DynamoDB** — single-table design (patrz schemat poniżej)
- **Amazon S3** — hosting frontendu + przechowywanie pomysłów wygenerowanych przez AI
- **Amazon CloudFront** — CDN dla frontendu (HTTPS, custom domain)
- **AWS Secrets Manager** — klucz API Anthropic Claude

### Infrastructure as Code
- **AWS CDK v2** (TypeScript)
- Jeden stack: `SapInnovationStack`

### CI/CD
- **GitHub Actions**
  - `push` na `main` → deploy do `production`
  - `push` na `develop` → deploy do `staging`
  - Osobne CloudFront distributions i DynamoDB tables per environment

---

## ARCHITEKTURA — SZCZEGÓŁOWY OPIS

### DynamoDB — Single Table Design

**Tabela:** `SapInnovation-{env}`

```
Partition Key: PK (String)
Sort Key:      SK (String)
GSI1:          GSI1PK / GSI1SK  (dla queries across entities)
GSI2:          GSI2PK / GSI2SK  (dla vote tallying)
```

**Wzorce dostępu i klucze:**

```
# POMYSŁ (Idea)
PK: IDEA#{ideaId}       SK: METADATA
GSI1PK: CATEGORY#{cat}  GSI1SK: IDEA#{ideaId}
Atrybuty: id, name, tagline, problem, solution, architecture,
          complexity, mvpTime, risk, riskNote, mrr, model,
          selfService, potential, category, createdAt,
          createdBy, status (active|hidden|archived), order

# GŁOS (Vote) — jeden user może głosować raz
PK: VOTE#{userId}       SK: IDEA#{ideaId}
GSI2PK: IDEA#{ideaId}   GSI2SK: VOTE#{userId}
Atrybuty: userId, ideaId, votedAt, userCompany

# SESJA GŁOSOWANIA — agregat per user
PK: SESSION#{userId}    SK: METADATA
Atrybuty: userId, userEmail, company, votedIdeas[],
          customIdea (tekst wolny), submittedAt, ipAddress

# POMYSŁ KLIENTA (własna propozycja)
PK: CUSTOM#{customId}   SK: METADATA
GSI1PK: STATUS#pending  GSI1SK: CUSTOM#{customId}
Atrybuty: id, authorId, authorEmail, company, title,
          description, createdAt, status, adminNotes

# WYNIKI (Cache agregatu — aktualizowany przez Lambda)
PK: RESULTS#CURRENT     SK: METADATA
Atrybuty: lastUpdated, votesByIdea{ideaId: count},
          totalVoters, participationRate, topIdeas[]

# USER PROFILE (klient)
PK: USER#{userId}       SK: PROFILE
Atrybuty: userId, email, company, role, invitedAt,
          lastLogin, hasVoted, votingDeadline
```

### Lambda Functions

Zbuduj następujące Lambda functions (każda w osobnym pliku, ESM):

**Auth Lambda (Cognito triggers):**
- `pre-signup-trigger.mjs` — blokuje self-signup dla CustomerPool
- `post-confirmation-trigger.mjs` — tworzy USER# rekord w DynamoDB

**Ideas API (`/api/ideas`):**
- `GET /api/ideas` — lista wszystkich aktywnych pomysłów (publiczne po auth)
- `GET /api/ideas/{id}` — szczegóły pomysłu
- `POST /api/ideas` — utwórz pomysł (tylko Team role)
- `PUT /api/ideas/{id}` — edytuj pomysł (tylko Team role)
- `DELETE /api/ideas/{id}` — archiwizuj pomysł (tylko Team role, soft delete)
- `PUT /api/ideas/reorder` — zmień kolejność wyświetlania (drag & drop)

**Voting API (`/api/votes`):**
- `GET /api/votes/my` — moje głosy (zalogowany customer)
- `POST /api/votes/submit` — złóż głosy (max 5 ideaId + customIdea text)
  - Idempotent — jeśli głosowano, aktualizuje (do deadline)
  - Atomowa aktualizacja RESULTS#CURRENT przez DynamoDB conditional write
- `GET /api/votes/results` — wyniki (tylko Team role) — pełne dane
- `GET /api/votes/summary` — podsumowanie publiczne po deadline

**Brainstorm API (`/api/brainstorm`) — tylko Team:**
- `POST /api/brainstorm/generate` — generuje pomysły przez Anthropic API
  - Body: `{ category, prompt, count: 4 }`
  - Wywołuje Claude claude-sonnet-4-6 z system promptem eksperta SAP/AWS
  - Zwraca structured JSON pomysłów
  - Zapisuje historię generowania do S3
- `GET /api/brainstorm/history` — lista poprzednich sesji generowania

**Admin API (`/api/admin`) — tylko Team:**
- `GET /api/admin/customers` — lista klientów z statusem głosowania
- `POST /api/admin/customers/invite` — zaproś klienta (Cognito + SES email)
- `PUT /api/admin/customers/{id}` — edytuj profil klienta
- `GET /api/admin/export` — eksport wyników do CSV (przez S3 presigned URL)
- `GET /api/admin/custom-ideas` — lista pomysłów zgłoszonych przez klientów

**Scheduled Lambda:**
- `results-aggregator.mjs` — EventBridge co 5 minut, przelicza RESULTS#CURRENT
- `deadline-notifier.mjs` — EventBridge, wysyła reminder email przez SES 48h przed deadline

### Cognito Setup

**CustomerPool:**
```
- No self-signup (Cognito AdminCreateUser only)
- Required attributes: email, custom:company
- MFA: OFF (prostota dla klientów)
- Temporary password expiry: 7 dni
- Custom message Lambda: polska wiadomość zaproszenia
- App Client: SPA (no client secret, PKCE flow)
```

**TeamPool:**
```
- Self-signup: OFF
- Required attributes: email, custom:role
- MFA: TOTP (opcjonalny)
- App Client: SPA
```

**Autoryzacja w Lambda:**
Każda Lambda sprawdza Cognito JWT przez `aws-jwt-verify` library.
Role check przez Cognito Group membership:
- Group `customers` → CustomerPool
- Group `team-members` → TeamPool  
- Group `team-admins` → TeamPool (pełny dostęp)

---

## FRONTEND — SZCZEGÓŁOWY OPIS WIDOKÓW

### Design System

**Paleta kolorów (CSS variables):**
```css
--bg: #0F1117
--surface: #1A1A2E
--surface-2: #16213E
--border: #2A2A3E
--text: #E8E6E0
--text-muted: #888888
--accent: #4A9EFF       /* primary — AWS blue */
--accent-2: #FF9900     /* secondary — AWS orange */
--success: #22C55E
--warning: #F59E0B
--danger: #EF4444
--purple: #A78BFA
```

**Typografia:**
- Display: `'DM Serif Display'` (Google Fonts) — nagłówki
- Body: `'IBM Plex Sans'` (Google Fonts) — treść
- Mono: `'IBM Plex Mono'` — kody, tagi, dane techniczne

**Komponenty bazowe do zbudowania:**
- `<Badge>` — kolorowy pill z wariantem (success/warning/danger/info)
- `<Card>` — dark surface z border i hover state
- `<Button>` — primary/secondary/ghost, loading state
- `<Input>` / `<Textarea>` — dark themed, focus ring accent
- `<Modal>` — centered overlay z escape key
- `<Toast>` — top-right notifications (success/error/info)
- `<Skeleton>` — loading placeholder

---

### PORTAL KLIENTA (`/vote`)

#### `/login` — Strona logowania
- Centered card na dark bg z subtle grid pattern
- Logo / nazwa platformy u góry
- Email + hasło + przycisk "Zaloguj"
- Komunikat: "Dostęp tylko dla zaproszonych partnerów SAP"
- Link "Zapomniałem hasła" → Cognito forgot password flow
- Po zalogowaniu redirect do `/vote/ideas`

#### `/vote/ideas` — Lista pomysłów
**Layout:** Nagłówek z postępem głosowania + grid kart

**Nagłówek:**
- "SAP Innovation Vote" + podtytuł
- Progress bar: "Wybrano X/5 pomysłów"
- Przycisk "Złóż głosy" (aktywny po wybraniu min. 1)
- Deadline countdown timer (jeśli ustawiony)

**Filtry:** Pills dla kategorii (Monitoring / Security / Automation / Migration / Analytics / Performance)

**Karta pomysłu (IdeaCard):**
- Numer + kategoria badge + nazwa (DM Serif Display)
- Tagline (kursywa, accent color)
- Problem (2-3 zdania)
- 3 tagi: Złożoność / Czas MVP / Model cenowy
- Przycisk "Wybierz" / "Odznacz" (toggle)
- Selected state: border glow accent, checkmark badge
- Kliknięcie w kartę → modal ze szczegółami

**Modal szczegółów pomysłu:**
- Pełny opis: Problem / Rozwiązanie / Architektura AWS / Ryzyko
- Szacowany MRR + model biznesowy
- Self-service vs. konsultant badge
- Przycisk "Wybierz ten pomysł" w modalu

#### `/vote/submit` — Podsumowanie i zgłoszenie
- Lista wybranych 5 (lub mniej) pomysłów z możliwością usunięcia
- Duże pole tekstowe: "Czy masz własny pomysł na narzędzie SAP?"
  - Placeholder: "Opisz problem który chciałbyś rozwiązać..."
  - Max 1000 znaków, counter
- Checkbox: "Wyrażam zgodę na kontakt w sprawie pilotażu"
- Przycisk "Prześlij głos" → loading → success screen
- Success screen: animacja konfetti (canvas-confetti library) + "Dziękujemy!"

#### `/vote/thankyou` — Po głosowaniu
- Podziękowanie + komunikat kiedy zostaną ogłoszone wyniki
- "Czy możemy się skontaktować?" → link do kalendarza (Calendly embed lub prosty formularz)

---

### PORTAL ZESPOŁU (`/team`)

#### `/team/login` — Logowanie wewnętrzne
- Identyczne z customer login ale inne Cognito pool
- Redirect do `/team/dashboard`

#### `/team/dashboard` — Główny dashboard
**Metryki u góry (4 karty):**
- Głosujących: X/Y zaproszonych (%)
- Top pomysł: nazwa + liczba głosów
- Pomysłów własnych klientów: X nowych
- Czas do deadline (lub "Głosowanie zakończone")

**Wykres (Recharts Horizontal Bar Chart):**
- Wszystkie aktywne pomysły posortowane po liczbie głosów
- Kolor bars: gradient accent
- Hover: tooltip z % głosujących i listą firm (anonimizowana opcjonalnie)

**Tabela klientów (prawa strona lub osobna karta):**
- Email | Firma | Status (nie głosował / głosował) | Data głosowania
- Filter: tylko nieaktywni → szybki reminder button

#### `/team/ideas` — Zarządzanie pomysłami
**Widok:**
- Lista wszystkich pomysłów (aktywne + zarchiwizowane)
- Drag & drop reordering (dnd-kit library)
- Toggle: aktywny / ukryty (nie pokazuj klientom)
- Przycisk: + Nowy pomysł (manual) | 🤖 Generuj z AI

**Modal: Edycja pomysłu**
- Formularz z polami: nazwa, tagline, kategoria, problem, rozwiązanie, architektura, złożoność, czas MVP, ryzyko, MRR, model, self-service, potencjał
- Autozapis draft (localStorage)
- Przycisk: Zapisz | Archiwizuj

**Panel: Generowanie AI (prawy sidebar lub osobna sekcja)**
- Dropdown: kategoria
- Textarea: własny prompt (opcjonalny)
- Slider: liczba pomysłów (2–6)
- Przycisk: "Generuj z Claude"
- Wyniki: karty wygenerowanych pomysłów z przyciskami "Dodaj do bazy" / "Odrzuć"
- Historia poprzednich sesji generowania

#### `/team/results` — Wyniki głosowania (pełne)
- Horizontalny bar chart wszystkich pomysłów
- Tabela: Rank | Pomysł | Głosy | % | Firmy (lista)
- Sekcja: Pomysły własne klientów (z filtrowaniem status: nowy/review/zaakceptowany)
- Przycisk: Eksport CSV (S3 presigned URL)
- Przycisk: Eksport PDF raportu

#### `/team/customers` — Zarządzanie klientami
- Tabela klientów ze statusem
- Przycisk: "Zaproś klienta" → modal z email + firma + deadline
- Bulk invite: upload CSV (email, firma)
- Resend invitation button
- Dezaktywacja konta

---

## CDK STACK — SZCZEGÓŁOWA IMPLEMENTACJA

Plik: `infrastructure/lib/sap-innovation-stack.ts`

```typescript
// Zbuduj następujące zasoby w kolejności:

// 1. DynamoDB Table
// - BillingMode: PAY_PER_REQUEST
// - PointInTimeRecovery: true
// - Encryption: KMS managed
// - GSI1: GSI1PK (HASH) + GSI1SK (RANGE), projection: ALL
// - GSI2: GSI2PK (HASH) + GSI2SK (RANGE), projection: ALL
// - RemovalPolicy: RETAIN dla production, DESTROY dla staging

// 2. Cognito User Pools
// - CustomerPool: no self-signup, email verification
// - TeamPool: no self-signup, optional MFA
// - Każdy pool: App Client dla SPA (PKCE, no secret)
// - Domain: cognito hosted UI (backup dla reset password)

// 3. S3 Buckets
// - FrontendBucket: static website, OAC dla CloudFront
// - DataBucket: brainstorm history, exports — versioning ON

// 4. Lambda Functions
// - Runtime: NODEJS_20_X, architecture: ARM_64 (cheaper)
// - Memory: 256MB domyślnie, 512MB dla brainstorm (Anthropic call)
// - Timeout: 10s domyślnie, 30s dla brainstorm
// - Environment variables: TABLE_NAME, CUSTOMER_POOL_ID, TEAM_POOL_ID, ANTHROPIC_SECRET_ARN
// - Wszystkie Lambda w VPC jeśli RDS, ale bez VPC dla serverless DynamoDB

// 5. Secrets Manager
// - Secret: AnthropicApiKey — wartość ustawiana manualnie po deploymencie
// - Lambda brainstorm ma GetSecretValue permission

// 6. API Gateway HTTP API
// - CORS: origin CloudFront domain, methods: GET/POST/PUT/DELETE/OPTIONS
// - JWT Authorizer: Cognito CustomerPool + TeamPool
// - Routes: wszystkie /api/* → odpowiednie Lambda
// - Stage: $default, auto-deploy

// 7. CloudFront Distribution
// - Origin 1: S3 FrontendBucket (OAC)
// - Origin 2: API Gateway (cache disabled dla /api/*)
// - Default behavior: SPA fallback → index.html (403/404 → index.html)
// - PriceClass: PriceClass_100 (US + Europe)
// - HTTPSOnly
// - Optional: custom domain (certificate w us-east-1 przez ACM)

// 8. SES Configuration
// - Email identity: verified domain lub email
// - Lambda invite ma SES SendEmail permission

// 9. EventBridge Rules
// - rate(5 minutes) → results-aggregator Lambda
// - cron(0 10 * * ? *) → deadline-notifier Lambda

// 10. CloudWatch
// - Dashboard z metrykami: Lambda errors, DynamoDB throttles, API Gateway 4xx/5xx
// - Alarms: Lambda error rate > 1% → SNS → email zespołu
```

---

## GITHUB ACTIONS — CI/CD

Plik: `.github/workflows/deploy.yml`

```yaml
# Triggeruje na push do main (production) i develop (staging)
# Steps:
# 1. checkout
# 2. setup node 20
# 3. npm ci (root + infrastructure)
# 4. npm run build (frontend Vite)
# 5. AWS credentials (OIDC — nie access keys! Skonfiguruj OIDC provider w AWS)
# 6. cdk deploy SapInnovationStack --require-approval never
# 7. aws s3 sync dist/ s3://frontend-bucket --delete
# 8. aws cloudfront create-invalidation --distribution-id $CF_ID --paths "/*"

# Secrets w GitHub:
# AWS_ROLE_ARN — IAM role z OIDC trust dla GitHub Actions
# Osobne role dla staging i production z minimalnym uprawnieniami
```

---

## STRUKTURA PROJEKTU

```
sap-innovation-platform/
├── .github/
│   └── workflows/
│       ├── deploy-production.yml
│       └── deploy-staging.yml
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/          # Badge, Button, Card, Input, Modal, Toast
│   │   │   ├── ideas/       # IdeaCard, IdeaModal, IdeaGrid
│   │   │   ├── voting/      # VoteProgress, VoteSubmit
│   │   │   ├── team/        # BrainstormPanel, ResultsChart, CustomerTable
│   │   │   └── layout/      # AppShell, Sidebar, TopNav
│   │   ├── pages/
│   │   │   ├── customer/    # Login, Ideas, Submit, Thankyou
│   │   │   └── team/        # Login, Dashboard, Ideas, Results, Customers
│   │   ├── stores/          # Zustand: auth, ideas, votes, ui
│   │   ├── hooks/           # useIdeas, useVoting, useBrainstorm, useAuth
│   │   ├── api/             # Typed API client (fetch wrapper)
│   │   ├── types/           # TypeScript interfaces
│   │   └── utils/           # formatters, validators
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── handlers/        # Jeden plik per Lambda function
│   │   ├── lib/             # DynamoDB client, auth utils, response helpers
│   │   └── types/           # Shared TypeScript types
│   └── package.json
├── infrastructure/
│   ├── lib/
│   │   └── sap-innovation-stack.ts
│   ├── bin/
│   │   └── app.ts
│   └── package.json
├── shared/
│   └── types.ts             # Types używane przez frontend i backend
└── README.md
```

---

## DANE STARTOWE — SEEDER

Zbuduj `backend/src/scripts/seed-ideas.ts`:

```typescript
// Importuje 20 pomysłów z /data/ideas.json
// Format JSON zgodny ze schematem DynamoDB
// Uruchamiany przez: npm run seed -- --env staging
// Idempotentny (sprawdza czy idea już istnieje przed zapisem)
// Pomysły do zaimportowania (skróty — pełna treść w /data/ideas.json):
// 1. SAPWatch — Real-time Log Intelligence
// 2. BasisPulse — SAP Health Score Dashboard
// 3. SAPTrace — HANA Performance Analyzer
// 4. SAPUptime — SLA Reporting
// 5. SoDMatrix — SoD Builder
// 6. SAPLicense Pro — Indirect Access Optimizer
// 7. SAPAudit Trail — Immutable Compliance Log
// 8. SAPVuln — Vulnerability Assessment
// 9. SAPLoad — Cloud-Scale Performance Testing
// 10. SAPBaseline — Performance Regression Detection
// 11. SAPPatch — Automated Patch Manager
// 12. SAPTransport — Intelligent Transport Management
// 13. SAPUser — User Lifecycle Management
// 14. SAPBackup — Backup Validation & Recovery Testing
// 15. SAPMigrate — Cloud Readiness Assessment
// 16. SAPCode Scanner — Custom Code Analyzer
// 17. SAPCost — AWS Cost Attribution
// 18. SAPInsights — Business Process Mining
// 19. SAPCapacity — Predictive Capacity Planning
// 20. SAPBenchmark — Industry Peer Benchmarking
```

---

## WYMAGANIA NIEFUNKCJONALNE

### Bezpieczeństwo
- HTTPS everywhere (CloudFront enforces)
- JWT validation w każdej Lambda (nie trust headers)
- Rate limiting: API Gateway throttling (100 req/s per IP)
- DynamoDB: encryption at rest (KMS)
- Secrets: nigdy w kodzie, tylko Secrets Manager
- CORS: tylko CloudFront domain jako allowed origin
- Content Security Policy headers przez CloudFront Functions

### Wydajność
- Lambda cold start: bundle size < 5MB (esbuild bundling)
- DynamoDB: wszystkie queries przez klucz główny lub GSI (no scan)
- CloudFront cache: statyczne assety 1 rok (content hash w nazwie)
- API responses: < 200ms p95 dla read operations

### Monitoring
- CloudWatch Logs dla wszystkich Lambda (structured JSON logging)
- X-Ray tracing dla Lambda + DynamoDB
- CloudWatch Dashboard: key metrics per environment
- Alarm na email jeśli: Lambda error rate > 1%, DynamoDB throttle > 0

### Koszty (szacunek miesięczny dla 100 klientów)
- Lambda: ~$0 (free tier)
- DynamoDB: ~$1 (on-demand, małe wolumeny)
- CloudFront: ~$2
- Cognito: ~$0 (free tier do 50k MAU)
- SES: ~$0 (free tier 62k emails)
- Secrets Manager: ~$0.40/secret/miesiąc
- **TOTAL: < $10/miesiąc** przy 100 klientach głosujących

---

## KOLEJNOŚĆ IMPLEMENTACJI

**Faza 1 — Infrastructure & Auth (Dzień 1–2):**
1. Inicjalizacja CDK projektu
2. DynamoDB table + Cognito pools
3. GitHub Actions z OIDC
4. Deploy do staging

**Faza 2 — Backend APIs (Dzień 3–5):**
1. Lambda boilerplate + auth middleware
2. Ideas CRUD API
3. Voting API z idempotency
4. Seed 20 pomysłów

**Faza 3 — Frontend Customer Portal (Dzień 6–8):**
1. Design system (komponenty bazowe)
2. Login flow (Cognito Amplify)
3. Ideas grid z filtrowaniem
4. Vote selection + submit
5. Thank you page

**Faza 4 — Frontend Team Portal (Dzień 9–11):**
1. Team login
2. Dashboard z wykresem wyników
3. Ideas management (CRUD + reorder)
4. Brainstorm AI panel (Anthropic API)
5. Customer management + invite

**Faza 5 — Polish & Production (Dzień 12–14):**
1. Email templates (SES)
2. Export CSV/PDF
3. CloudWatch alarms
4. Security review (CORS, CSP, rate limiting)
5. Deploy production + DNS

---

## PIERWSZE KROKI PO WYGENEROWANIU

```bash
# 1. Zainstaluj zależności
cd infrastructure && npm ci
cd ../frontend && npm ci  
cd ../backend && npm ci

# 2. Bootstrap CDK (raz per konto/region)
npx cdk bootstrap aws://ACCOUNT_ID/eu-central-1

# 3. Deploy staging
cd infrastructure
npx cdk deploy SapInnovationStack-staging

# 4. Ustaw Anthropic API key w Secrets Manager
aws secretsmanager put-secret-value \
  --secret-id AnthropicApiKey-staging \
  --secret-string "sk-ant-TWOJ_KLUCZ"

# 5. Seed pomysłów
cd ../backend
npm run seed -- --env staging

# 6. Zaproś pierwszego klienta testowego przez Team Portal
# Otwórz CloudFront URL → /team/login → Customers → Invite
```

---

*Wygenerowano: 2026 | SAP × AWS Innovation Platform*

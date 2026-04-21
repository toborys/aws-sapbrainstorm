import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface SapInnovationStackProps extends cdk.StackProps {
  stageName: string;
  domainName: string;
  hostedZoneId: string;
  hostedZoneName: string;
}

export class SapInnovationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SapInnovationStackProps) {
    super(scope, id, props);

    const { stageName, domainName, hostedZoneId, hostedZoneName } = props;
    const isProd = stageName === 'production';

    // ─── 1. DynamoDB Table ───────────────────────────────────────────
    const table = new dynamodb.Table(this, 'MainTable', {
      tableName: `SapInnovation-${stageName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ─── 2. Cognito User Pools ───────────────────────────────────────
    const customerPool = new cognito.UserPool(this, 'CustomerPool', {
      userPoolName: `SapInnovation-Customers-${stageName}`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
      },
      customAttributes: {
        company: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const customerClient = customerPool.addClient('CustomerWebClient', {
      authFlows: { userSrp: true, userPassword: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [`https://${domainName}/login/callback`, 'http://localhost:5173/login/callback'],
        logoutUrls: [`https://${domainName}/login`, 'http://localhost:5173/login'],
      },
      preventUserExistenceErrors: true,
    });

    new cognito.CfnUserPoolGroup(this, 'CustomersGroup', {
      userPoolId: customerPool.userPoolId,
      groupName: 'customers',
      description: 'SAP Customer users who can vote',
    });

    const teamPool = new cognito.UserPool(this, 'TeamPool', {
      userPoolName: `SapInnovation-Team-${stageName}`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
      },
      customAttributes: {
        role: new cognito.StringAttribute({ mutable: true }),
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: false, otp: true },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const teamClient = teamPool.addClient('TeamWebClient', {
      authFlows: { userSrp: true, userPassword: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [`https://${domainName}/team/login/callback`, 'http://localhost:5173/team/login/callback'],
        logoutUrls: [`https://${domainName}/team/login`, 'http://localhost:5173/team/login'],
      },
      preventUserExistenceErrors: true,
    });

    new cognito.CfnUserPoolGroup(this, 'TeamMembersGroup', {
      userPoolId: teamPool.userPoolId,
      groupName: 'team-members',
      description: 'Internal team members',
    });

    new cognito.CfnUserPoolGroup(this, 'TeamAdminsGroup', {
      userPoolId: teamPool.userPoolId,
      groupName: 'team-admins',
      description: 'Team admins with full access',
    });

    // ─── 3. S3 Buckets ──────────────────────────────────────────────
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `sap-innovation-frontend-${stageName}-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    const dataBucket = new s3.Bucket(this, 'DataBucket', {
      bucketName: `sap-innovation-data-${stageName}-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    // ─── 5. Lambda Functions ─────────────────────────────────────────
    const lambdaEnv: Record<string, string> = {
      TABLE_NAME: table.tableName,
      CUSTOMER_POOL_ID: customerPool.userPoolId,
      TEAM_POOL_ID: teamPool.userPoolId,
      CUSTOMER_CLIENT_ID: customerClient.userPoolClientId,
      TEAM_CLIENT_ID: teamClient.userPoolClientId,
      DATA_BUCKET: dataBucket.bucketName,
      STAGE: stageName,
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
    };

    const createLambda = (name: string, handler: string, opts?: {
      memory?: number;
      timeout?: number;
    }) => {
      const fn = new lambda.Function(this, name, {
        functionName: `SapInnovation-${name}-${stageName}`,
        runtime: lambda.Runtime.NODEJS_20_X,
        architecture: lambda.Architecture.ARM_64,
        handler,
        code: lambda.Code.fromAsset(path.join(__dirname, '../../backend'), {
          exclude: ['src', 'tsconfig.json', '*.ts'],
        }),
        memorySize: opts?.memory ?? 256,
        timeout: cdk.Duration.seconds(opts?.timeout ?? 10),
        environment: lambdaEnv,
        logRetention: logs.RetentionDays.TWO_WEEKS,
        tracing: lambda.Tracing.ACTIVE,
      });
      table.grantReadWriteData(fn);
      return fn;
    };

    // Ideas API
    const ideasListFn = createLambda('IdeasList', 'dist/handlers/ideas-list.handler');
    const ideasGetFn = createLambda('IdeasGet', 'dist/handlers/ideas-get.handler');
    // IdeasCreate now generates a Titan embedding + scans existing ideas
    // for duplicates — needs more memory and a longer timeout than the
    // default 256MB/10s.
    const ideasCreateFn = createLambda('IdeasCreate', 'dist/handlers/ideas-create.handler', {
      memory: 512,
      timeout: 30,
    });
    dataBucket.grantReadWrite(ideasCreateFn); // Knowledge Base mirror
    ideasCreateFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['*'],
    }));
    const ideasUpdateFn = createLambda('IdeasUpdate', 'dist/handlers/ideas-update.handler');
    const ideasDeleteFn = createLambda('IdeasDelete', 'dist/handlers/ideas-delete.handler');
    const ideasReorderFn = createLambda('IdeasReorder', 'dist/handlers/ideas-reorder.handler');
    const ideasBuildKitFn = createLambda('IdeasBuildKit', 'dist/handlers/ideas-build-kit.handler', {
      memory: 512,
      timeout: 30,
    });
    dataBucket.grantReadWrite(ideasBuildKitFn);
    table.grantReadData(ideasBuildKitFn);

    // Push-to-GitHub: creates a repo and commits the build-kit files via
    // GitHub REST API using a user-provided PAT (passed in request body).
    // 9 blobs + 3 other API calls — allow timeout margin.
    const ideasPushGithubFn = createLambda('IdeasPushGithub', 'dist/handlers/ideas-push-to-github.handler', {
      memory: 512,
      timeout: 60,
    });
    table.grantReadData(ideasPushGithubFn);

    // One-shot backfill for existing ideas without embeddings. Bedrock is
    // throttled per-account so we keep this on a longer timeout.
    const ideasBackfillEmbeddingsFn = createLambda(
      'IdeasBackfillEmbeddings',
      'dist/handlers/ideas-backfill-embeddings.handler',
      { memory: 512, timeout: 300 },
    );
    ideasBackfillEmbeddingsFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['*'],
    }));

    // Voting API
    const votesMyFn = createLambda('VotesMy', 'dist/handlers/votes-my.handler');
    const votesSubmitFn = createLambda('VotesSubmit', 'dist/handlers/votes-submit.handler');
    dataBucket.grantReadWrite(votesSubmitFn); // Knowledge Base mirror for custom ideas
    const votesResultsFn = createLambda('VotesResults', 'dist/handlers/votes-results.handler');
    const votesSummaryFn = createLambda('VotesSummary', 'dist/handlers/votes-summary.handler');

    // Brainstorm API
    // Brainstorm worker (async, invoked by generate Lambda)
    const brainstormWorkerFn = createLambda('BrainstormWorker', 'dist/handlers/brainstorm-worker.handler', {
      memory: 1024,
      timeout: 300,
    });
    brainstormWorkerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['*'],
    }));
    dataBucket.grantReadWrite(brainstormWorkerFn);
    table.grantReadData(brainstormWorkerFn); // Evolve mode reads seed idea from DDB

    // Brainstorm generate (API-facing, starts async worker)
    const brainstormGenerateFn = createLambda('BrainstormGenerate', 'dist/handlers/brainstorm-generate.handler', {
      memory: 256,
      timeout: 10,
    });
    brainstormGenerateFn.addEnvironment('WORKER_FUNCTION_NAME', brainstormWorkerFn.functionName);
    brainstormWorkerFn.grantInvoke(brainstormGenerateFn);
    dataBucket.grantReadWrite(brainstormGenerateFn);
    brainstormGenerateFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [brainstormWorkerFn.functionArn],
    }));

    // Brainstorm status (polling endpoint)
    const brainstormStatusFn = createLambda('BrainstormStatus', 'dist/handlers/brainstorm-status.handler');
    dataBucket.grantRead(brainstormStatusFn);

    const brainstormHistoryFn = createLambda('BrainstormHistory', 'dist/handlers/brainstorm-history.handler');
    dataBucket.grantRead(brainstormHistoryFn);

    // Knowledge Base stats
    const kbStatsFn = createLambda('KnowledgeBaseStats', 'dist/handlers/knowledge-base-stats.handler');
    dataBucket.grantRead(kbStatsFn);

    // Admin API
    const adminCustomersListFn = createLambda('AdminCustomersList', 'dist/handlers/admin-customers-list.handler');
    const adminCustomersInviteFn = createLambda('AdminCustomersInvite', 'dist/handlers/admin-customers-invite.handler');
    adminCustomersInviteFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:AdminCreateUser', 'cognito-idp:AdminAddUserToGroup'],
      resources: [customerPool.userPoolArn],
    }));
    adminCustomersInviteFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail'],
      resources: ['*'],
    }));

    const adminCustomersInviteBulkFn = createLambda('AdminCustomersInviteBulk', 'dist/handlers/admin-customers-invite-bulk.handler', {
      memory: 256,
      timeout: 120, // sequential processing, up to 100 users
    });
    adminCustomersInviteBulkFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:AdminCreateUser', 'cognito-idp:AdminAddUserToGroup'],
      resources: [customerPool.userPoolArn],
    }));

    const adminCustomersUpdateFn = createLambda('AdminCustomersUpdate', 'dist/handlers/admin-customers-update.handler');
    const adminExportFn = createLambda('AdminExport', 'dist/handlers/admin-export.handler');
    dataBucket.grantWrite(adminExportFn);

    const adminCustomIdeasFn = createLambda('AdminCustomIdeas', 'dist/handlers/admin-custom-ideas.handler');

    // Scheduled Lambdas
    const resultsAggregatorFn = createLambda('ResultsAggregator', 'dist/handlers/results-aggregator.handler');
    const deadlineNotifierFn = createLambda('DeadlineNotifier', 'dist/handlers/deadline-notifier.handler');
    deadlineNotifierFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail'],
      resources: ['*'],
    }));

    // Cognito triggers — separate env to avoid circular dependency with CustomerPool
    const triggerEnv: Record<string, string> = {
      TABLE_NAME: table.tableName,
      STAGE: stageName,
    };

    const preSignupFn = new lambda.Function(this, 'PreSignupTrigger', {
      functionName: `SapInnovation-PreSignupTrigger-${stageName}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'dist/handlers/pre-signup-trigger.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend'), {
          exclude: ['src', 'tsconfig.json', '*.ts'],
        }),
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: triggerEnv,
      tracing: lambda.Tracing.ACTIVE,
    });

    const postConfirmationFn = new lambda.Function(this, 'PostConfirmationTrigger', {
      functionName: `SapInnovation-PostConfirmationTrigger-${stageName}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'dist/handlers/post-confirmation-trigger.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend'), {
          exclude: ['src', 'tsconfig.json', '*.ts'],
        }),
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: triggerEnv,
      tracing: lambda.Tracing.ACTIVE,
    });
    table.grantReadWriteData(postConfirmationFn);

    customerPool.addTrigger(cognito.UserPoolOperation.PRE_SIGN_UP, preSignupFn);
    customerPool.addTrigger(cognito.UserPoolOperation.POST_CONFIRMATION, postConfirmationFn);

    // ─── 6. API Gateway HTTP API ─────────────────────────────────────
    const httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: `SapInnovation-API-${stageName}`,
      corsPreflight: {
        allowOrigins: [`https://${domainName}`, 'http://localhost:5173'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Authorization', 'Content-Type'],
        maxAge: cdk.Duration.hours(1),
      },
    });

    // JWT Authorizers
    const customerAuthorizer = new authorizers.HttpJwtAuthorizer('CustomerAuth', `https://cognito-idp.eu-central-1.amazonaws.com/${customerPool.userPoolId}`, {
      jwtAudience: [customerClient.userPoolClientId],
    });

    const teamAuthorizer = new authorizers.HttpJwtAuthorizer('TeamAuth', `https://cognito-idp.eu-central-1.amazonaws.com/${teamPool.userPoolId}`, {
      jwtAudience: [teamClient.userPoolClientId],
    });

    // Routes — Ideas (both customer and team — Lambda verifies token from either pool)
    httpApi.addRoutes({
      path: '/api/ideas',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('IdeasListInt', ideasListFn),
    });
    httpApi.addRoutes({
      path: '/api/ideas/{id}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('IdeasGetInt', ideasGetFn),
    });

    // Routes — Ideas management (team-only)
    httpApi.addRoutes({
      path: '/api/ideas',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('IdeasCreateInt', ideasCreateFn),
      authorizer: teamAuthorizer,
    });
    httpApi.addRoutes({
      path: '/api/ideas/{id}',
      methods: [apigatewayv2.HttpMethod.PUT],
      integration: new integrations.HttpLambdaIntegration('IdeasUpdateInt', ideasUpdateFn),
      authorizer: teamAuthorizer,
    });
    httpApi.addRoutes({
      path: '/api/ideas/{id}',
      methods: [apigatewayv2.HttpMethod.DELETE],
      integration: new integrations.HttpLambdaIntegration('IdeasDeleteInt', ideasDeleteFn),
      authorizer: teamAuthorizer,
    });
    httpApi.addRoutes({
      path: '/api/ideas/reorder',
      methods: [apigatewayv2.HttpMethod.PUT],
      integration: new integrations.HttpLambdaIntegration('IdeasReorderInt', ideasReorderFn),
      authorizer: teamAuthorizer,
    });
    httpApi.addRoutes({
      path: '/api/ideas/{id}/build-kit',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('IdeasBuildKitInt', ideasBuildKitFn),
      authorizer: teamAuthorizer,
    });
    httpApi.addRoutes({
      path: '/api/ideas/{id}/push-to-github',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('IdeasPushGithubInt', ideasPushGithubFn),
      authorizer: teamAuthorizer,
    });
    httpApi.addRoutes({
      path: '/api/ideas/backfill-embeddings',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        'IdeasBackfillEmbeddingsInt',
        ideasBackfillEmbeddingsFn,
      ),
      authorizer: teamAuthorizer,
    });

    // Routes — Voting
    httpApi.addRoutes({
      path: '/api/votes/my',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('VotesMyInt', votesMyFn),
      authorizer: customerAuthorizer,
    });
    httpApi.addRoutes({
      path: '/api/votes/submit',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('VotesSubmitInt', votesSubmitFn),
      authorizer: customerAuthorizer,
    });
    httpApi.addRoutes({
      path: '/api/votes/results',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('VotesResultsInt', votesResultsFn),
      authorizer: teamAuthorizer,
    });
    httpApi.addRoutes({
      path: '/api/votes/summary',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('VotesSummaryInt', votesSummaryFn),
      authorizer: customerAuthorizer,
    });

    // Routes — Brainstorm (team-only)
    httpApi.addRoutes({
      path: '/api/brainstorm/generate',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('BrainstormGenInt', brainstormGenerateFn),
      authorizer: teamAuthorizer,
    });
    httpApi.addRoutes({
      path: '/api/brainstorm/status/{sessionId}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('BrainstormStatusInt', brainstormStatusFn),
      authorizer: teamAuthorizer,
    });
    httpApi.addRoutes({
      path: '/api/brainstorm/history',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('BrainstormHistInt', brainstormHistoryFn),
      authorizer: teamAuthorizer,
    });
    httpApi.addRoutes({
      path: '/api/knowledge-base/stats',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('KbStatsInt', kbStatsFn),
      authorizer: teamAuthorizer,
    });

    // Routes — Admin (team-only)
    httpApi.addRoutes({
      path: '/api/admin/customers',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('AdminCustListInt', adminCustomersListFn),
      authorizer: teamAuthorizer,
    });
    httpApi.addRoutes({
      path: '/api/admin/customers/invite',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('AdminCustInvInt', adminCustomersInviteFn),
      authorizer: teamAuthorizer,
    });
    httpApi.addRoutes({
      path: '/api/admin/customers/invite/bulk',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('AdminCustInvBulkInt', adminCustomersInviteBulkFn),
      authorizer: teamAuthorizer,
    });
    httpApi.addRoutes({
      path: '/api/admin/customers/{id}',
      methods: [apigatewayv2.HttpMethod.PUT],
      integration: new integrations.HttpLambdaIntegration('AdminCustUpdInt', adminCustomersUpdateFn),
      authorizer: teamAuthorizer,
    });
    httpApi.addRoutes({
      path: '/api/admin/export',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('AdminExportInt', adminExportFn),
      authorizer: teamAuthorizer,
    });
    httpApi.addRoutes({
      path: '/api/admin/custom-ideas',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('AdminCustomIdeasInt', adminCustomIdeasFn),
      authorizer: teamAuthorizer,
    });

    // ─── 7. CloudFront + ACM + Route 53 ─────────────────────────────
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId,
      zoneName: hostedZoneName,
    });

    const certificate = new acm.DnsValidatedCertificate(this, 'Certificate', {
      domainName,
      hostedZone,
      region: 'us-east-1',
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(`${httpApi.httpApiId}.execute-api.eu-central-1.amazonaws.com`, {
            readTimeout: cdk.Duration.seconds(120),
            keepaliveTimeout: cdk.Duration.seconds(60),
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
      },
      domainNames: [domainName],
      certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
    });

    new route53.ARecord(this, 'AliasRecord', {
      zone: hostedZone,
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

    // ─── 8. EventBridge Schedules ────────────────────────────────────
    new events.Rule(this, 'ResultsAggregatorSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new eventsTargets.LambdaFunction(resultsAggregatorFn)],
    });

    new events.Rule(this, 'DeadlineNotifierSchedule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '10' }),
      targets: [new eventsTargets.LambdaFunction(deadlineNotifierFn)],
    });

    // ─── 9. Monitoring & Alarms ──────────────────────────────────────
    const alertTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: `SapInnovation-Alerts-${stageName}`,
    });

    // Lambda error alarm (aggregated across all functions)
    const lambdaFunctions = [
      ideasListFn, ideasGetFn, ideasCreateFn, ideasUpdateFn, ideasDeleteFn,
      votesMyFn, votesSubmitFn, votesResultsFn,
      brainstormGenerateFn, adminCustomersInviteFn,
    ];

    for (const fn of lambdaFunctions) {
      const errorAlarm = fn.metricErrors({ period: cdk.Duration.minutes(5) }).createAlarm(this, `${fn.node.id}ErrorAlarm`, {
        threshold: 1,
        evaluationPeriods: 2,
        alarmDescription: `Lambda ${fn.functionName} error rate alarm`,
      });
      errorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));
    }

    // DynamoDB throttle alarm
    const throttleAlarm = table.metricThrottledRequestsForOperation('PutItem', {
      period: cdk.Duration.minutes(5),
    }).createAlarm(this, 'DynamoThrottleAlarm', {
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: 'DynamoDB throttling detected',
    });
    throttleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));

    // ─── 10. Outputs ─────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'CloudFrontDomain', { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, 'CloudFrontDistributionId', { value: distribution.distributionId });
    new cdk.CfnOutput(this, 'CustomDomain', { value: `https://${domainName}` });
    new cdk.CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, 'CustomerPoolId', { value: customerPool.userPoolId });
    new cdk.CfnOutput(this, 'CustomerClientId', { value: customerClient.userPoolClientId });
    new cdk.CfnOutput(this, 'TeamPoolId', { value: teamPool.userPoolId });
    new cdk.CfnOutput(this, 'TeamClientId', { value: teamClient.userPoolClientId });
    new cdk.CfnOutput(this, 'TableName', { value: table.tableName });
    new cdk.CfnOutput(this, 'FrontendBucketName', { value: frontendBucket.bucketName });
    new cdk.CfnOutput(this, 'DataBucketName', { value: dataBucket.bucketName });
    new cdk.CfnOutput(this, 'AlertTopicArn', { value: alertTopic.topicArn });
  }
}

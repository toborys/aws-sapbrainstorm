#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SapInnovationStack } from '../lib/sap-innovation-stack';

const app = new cdk.App();

const env = app.node.tryGetContext('env') || 'staging';
const domainName = 'sap.apexit.tv';
const hostedZoneId = 'Z01003733N39JM8SVMOS2';
const hostedZoneName = 'apexit.tv';

new SapInnovationStack(app, `SapInnovation-${env}`, {
  env: {
    account: '195275651669',
    region: 'eu-central-1',
  },
  crossRegionReferences: true,
  stageName: env,
  domainName: env === 'production' ? domainName : `${env}.${domainName}`,
  hostedZoneId,
  hostedZoneName,
});

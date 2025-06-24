#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { ClientVpnWithCertificateAuth } from '@ckimrie/cdk-vpn';

const app = new cdk.App();

class TestStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC for the test
    const vpc = new ec2.Vpc(this, 'TestVpc', {
      availabilityZones: ['us-east-1a', 'us-east-1b'],
      natGateways: 1,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // Test default configuration
    new ClientVpnWithCertificateAuth(this, 'DefaultClientVpn', {
      vpc,
    });

    // Test custom CIDR configuration
    new ClientVpnWithCertificateAuth(this, 'CustomCidrClientVpn', {
      vpc,
      clientCidrBlock: '192.168.0.0/16',
    });
  }
}

// Create test stack
new TestStack(app, 'TestStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || '123456789012',
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});

app.synth();
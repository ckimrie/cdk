import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as path from 'path';

export interface ClientVpnWithCertificateAuthProps {
  vpc: ec2.IVpc;
  clientCidrBlock?: string;
}

export class ClientVpnWithCertificateAuth extends Construct {
  public readonly ovpnFileSecretArn: string;
  public readonly clientVpnEndpointId: string;

  public constructor(scope: Construct, id: string, props: ClientVpnWithCertificateAuthProps) {
    super(scope, id);
    
    const { vpc, clientCidrBlock = '10.0.0.0/16' } = props;
    
    // Create singleton Lambda function for certificate generation
    const certificateLambda = this.getOrCreateSingletonFunction(
      'VpnCertificateGeneratorSingleton',
      'certificate-generator',
      {
        policies: [
          new iam.PolicyStatement({
            actions: [
              'acm:ImportCertificate',
              'acm:ListCertificates',
              'acm:DescribeCertificate'
            ],
            resources: ['*']
          }),
          new iam.PolicyStatement({
            actions: [
              'ssm:PutParameter',
              'ssm:GetParameter',
              'ssm:DeleteParameter'
            ],
            resources: ['*']
          })
        ]
      }
    );

    // Create singleton Lambda function for OVPN generation
    const ovpnLambda = this.getOrCreateSingletonFunction(
      'VpnOvpnGeneratorSingleton',
      'ovpn-generator',
      {
        policies: [
          new iam.PolicyStatement({
            actions: [
              'ec2:DescribeClientVpnEndpoints'
            ],
            resources: ['*']
          }),
          new iam.PolicyStatement({
            actions: [
              'secretsmanager:CreateSecret',
              'secretsmanager:UpdateSecret',
              'secretsmanager:DeleteSecret'
            ],
            resources: ['*']
          }),
          new iam.PolicyStatement({
            actions: [
              'ssm:GetParameter'
            ],
            resources: ['*']
          })
        ]
      }
    );

    // Create custom resource for certificate generation
    const certificateProvider = this.getOrCreateSingletonProvider(
      'VpnCertificateProvider',
      certificateLambda
    );

    const certificateResource = new cdk.CustomResource(this, 'CertificateResource', {
      serviceToken: certificateProvider.serviceToken,
      properties: {
        Config: {
          organizationName: 'VPN Organization',
          organizationalUnit: 'IT Department',
          country: 'US',
          state: 'California',
          city: 'San Francisco',
          keySize: 2048,
          validityPeriodDays: 365
        }
      }
    });

    // Create Client VPN endpoint
    const clientVpnEndpoint = new ec2.CfnClientVpnEndpoint(this, 'ClientVpnEndpoint', {
      authenticationOptions: [{
        type: 'certificate-authentication',
        mutualAuthentication: {
          clientRootCertificateChainArn: certificateResource.getAtt('CaCertificateArn').toString()
        }
      }],
      clientCidrBlock: clientCidrBlock,
      connectionLogOptions: {
        enabled: false
      },
      serverCertificateArn: certificateResource.getAtt('ServerCertificateArn').toString(),
      vpcId: vpc.vpcId,
      transportProtocol: 'udp',
      vpnPort: 443
    });

    // Create custom resource for OVPN generation  
    const ovpnProvider = this.getOrCreateSingletonProvider(
      'VpnOvpnProvider',
      ovpnLambda
    );

    const ovpnResource = new cdk.CustomResource(this, 'OvpnResource', {
      serviceToken: ovpnProvider.serviceToken,
      properties: {
        ClientVpnEndpointId: clientVpnEndpoint.ref,
        CertificateResourceId: certificateResource.ref,
        Config: {
          clientCidr: clientCidrBlock,
          serverPort: 443,
          protocol: 'udp',
          splitTunnel: true
        }
      }
    });

    ovpnResource.node.addDependency(clientVpnEndpoint);

    // Set outputs
    this.clientVpnEndpointId = clientVpnEndpoint.ref;
    this.ovpnFileSecretArn = ovpnResource.getAtt('OvpnSecretArn').toString();
  }

  private getOrCreateSingletonFunction(
    singletonId: string,
    handlerDir: string,
    options: {
      policies: iam.PolicyStatement[];
    }
  ): lambda.Function {
    const constructName = `${singletonId}`;
    
    // Find the stack to create singletons at stack level
    const stack = cdk.Stack.of(this);
    
    // Check if singleton already exists in the stack
    const existing = stack.node.tryFindChild(constructName) as lambda.Function;
    if (existing) {
      return existing;
    }

    // Create the singleton function at the stack level
    const func = new lambda.Function(stack, constructName, {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambdas', handlerDir)),
      timeout: cdk.Duration.minutes(5),
      initialPolicy: options.policies
    });

    return func;
  }

  private getOrCreateSingletonProvider(
    singletonId: string,
    handler: lambda.Function
  ): cr.Provider {
    const constructName = `${singletonId}`;
    
    // Find the stack to create singletons at stack level
    const stack = cdk.Stack.of(this);
    
    // Check if singleton already exists in the stack
    const existing = stack.node.tryFindChild(constructName) as cr.Provider;
    if (existing) {
      return existing;
    }

    // Create the singleton provider at the stack level
    const provider = new cr.Provider(stack, constructName, {
      onEventHandler: handler
    });

    return provider;
  }
}
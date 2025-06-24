import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { ClientVpnWithCertificateAuth } from '../lib/index';

const getMockVpc = (stack: cdk.Stack): ec2.IVpc => {
  return new ec2.Vpc(stack, 'TestVpc', {
    maxAzs: 2,
    natGateways: 1
  });
};

describe('ClientVpnWithCertificateAuth', () => {
  it('should create construct with VPC as only required parameter', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    const vpc = getMockVpc(stack);

    const clientVpn = new ClientVpnWithCertificateAuth(stack, 'TestClientVpn', {
      vpc: vpc
    });

    expect(clientVpn).toBeDefined();

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::EC2::ClientVpnEndpoint', 1);
  });

  it('should automatically generate certificates with sensible defaults when no custom CA provided', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    const vpc = getMockVpc(stack);

    new ClientVpnWithCertificateAuth(stack, 'TestClientVpn', {
      vpc: vpc
    });

    const template = Template.fromStack(stack);

    // Should create Lambda functions for certificate generation (at least one for our custom logic)
    template.resourceCountIs('AWS::Lambda::Function', 4);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs18.x',
      Handler: 'index.handler'
    });

    // Should create custom resource for certificate generation
    template.resourceCountIs('AWS::CloudFormation::CustomResource', 2);

    // Client VPN endpoint should use certificate authentication with generated certificates
    const vpnEndpoint = template.findResources('AWS::EC2::ClientVpnEndpoint');
    const vpnEndpointKey = Object.keys(vpnEndpoint)[0];
    const vpnEndpointProps = vpnEndpoint[vpnEndpointKey].Properties;

    expect(vpnEndpointProps.AuthenticationOptions[0].Type).toBe(
      'certificate-authentication'
    );
    expect(
      vpnEndpointProps.AuthenticationOptions[0].MutualAuthentication
        .ClientRootCertificateChainArn
    ).toHaveProperty('Fn::GetAtt');
    expect(vpnEndpointProps.ServerCertificateArn).toHaveProperty('Fn::GetAtt');
  });

  it('should generate .ovpn file with embedded certificates and store in Secrets Manager', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    const vpc = getMockVpc(stack);

    const clientVpn = new ClientVpnWithCertificateAuth(stack, 'TestClientVpn', {
      vpc: vpc
    });

    const template = Template.fromStack(stack);

    // Should create 2 custom resources: one for certificate generation, one for .ovpn generation
    template.resourceCountIs('AWS::CloudFormation::CustomResource', 2);

    // Should create 2 singleton Lambda functions: certificate generator and ovpn generator
    template.resourceCountIs('AWS::Lambda::Function', 4); // 2 singletons + 2 CDK provider functions

    // Should create Lambda function with correct permissions for Secrets Manager
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['secretsmanager:CreateSecret']),
            Effect: 'Allow'
          })
        ])
      }
    });

    // Verify that the construct exposes the ovpn secret ARN
    expect(clientVpn.ovpnFileSecretArn).toBeDefined();

    // Verify that the construct exposes the client VPN endpoint ID
    expect(clientVpn.clientVpnEndpointId).toBeDefined();
  });

  it('should reuse singleton Lambda functions when multiple VPN constructs are created in same stack', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    const vpc1 = new ec2.Vpc(stack, 'TestVpc1', { maxAzs: 2, natGateways: 1 });
    const vpc2 = new ec2.Vpc(stack, 'TestVpc2', { maxAzs: 2, natGateways: 1 });

    // Create two VPN constructs in the same stack
    new ClientVpnWithCertificateAuth(stack, 'TestClientVpn1', { vpc: vpc1 });
    new ClientVpnWithCertificateAuth(stack, 'TestClientVpn2', { vpc: vpc2 });

    const template = Template.fromStack(stack);

    // Should create 2 VPN endpoints
    template.resourceCountIs('AWS::EC2::ClientVpnEndpoint', 2);

    // Should create 4 custom resources (2 for each VPN)
    template.resourceCountIs('AWS::CloudFormation::CustomResource', 4);

    const lambdaFunctions = template.findResources('AWS::Lambda::Function');

    // Should have our 2 singleton Lambda functions (certificate + ovpn generators)
    // Plus 2 CDK provider framework functions (singleton providers working!)
    // This means singletons are working for both business logic AND provider functions
    template.resourceCountIs('AWS::Lambda::Function', 4);

    // Verify our singleton Lambda functions exist only once
    const singletonCertificateGenerators = Object.keys(lambdaFunctions).filter(
      id => id.includes('VpnCertificateGeneratorSingleton')
    );
    const singletonOvpnGenerators = Object.keys(lambdaFunctions).filter(id =>
      id.includes('VpnOvpnGeneratorSingleton')
    );

    expect(singletonCertificateGenerators).toHaveLength(1);
    expect(singletonOvpnGenerators).toHaveLength(1);
  });

  it('should use default CIDR block when no custom CIDR is provided', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    const vpc = getMockVpc(stack);

    new ClientVpnWithCertificateAuth(stack, 'TestClientVpn', {
      vpc: vpc
    });

    const template = Template.fromStack(stack);

    // Should use default CIDR block in VPN endpoint
    template.hasResourceProperties('AWS::EC2::ClientVpnEndpoint', {
      ClientCidrBlock: '10.0.0.0/16'
    });

    // Should use default CIDR block in OVPN configuration
    template.hasResourceProperties('AWS::CloudFormation::CustomResource', {
      Config: Match.objectLike({
        clientCidr: '10.0.0.0/16'
      })
    });
  });

  it('should use custom CIDR block when provided', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    const vpc = getMockVpc(stack);

    new ClientVpnWithCertificateAuth(stack, 'TestClientVpn', {
      vpc: vpc,
      clientCidrBlock: '192.168.0.0/16'
    });

    const template = Template.fromStack(stack);

    // Should use custom CIDR block in VPN endpoint
    template.hasResourceProperties('AWS::EC2::ClientVpnEndpoint', {
      ClientCidrBlock: '192.168.0.0/16'
    });

    // Should use custom CIDR block in OVPN configuration
    template.hasResourceProperties('AWS::CloudFormation::CustomResource', {
      Config: Match.objectLike({
        clientCidr: '192.168.0.0/16'
      })
    });
  });
});

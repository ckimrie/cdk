import * as crypto from 'crypto';
import {
  OvpnGeneratorEvent,
  OvpnGeneratorResult
} from '../../lib/lambdas/ovpn-generator/types';

// Mock AWS SDK v3 with undefined ClientVpnEndpoints
jest.mock('@aws-sdk/client-ec2', () => ({
  EC2Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({
      ClientVpnEndpoints: undefined // This triggers the || [] fallback
    })
  })),
  DescribeClientVpnEndpointsCommand: jest.fn().mockImplementation((input) => input)
}));

jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({
      ARN:
        'arn:aws:secretsmanager:us-east-1:123456789012:secret:ovpn-file-' +
        crypto.randomUUID()
    })
  })),
  CreateSecretCommand: jest.fn().mockImplementation((input) => input)
}));

jest.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockImplementation((command) => {
      const paramName = command.input?.Name ?? '';
      return Promise.resolve({
        Parameter: {
          Value: paramName.includes('private-key') === true
            ? '-----BEGIN RSA PRIVATE KEY-----\nMOCK_PRIVATE_KEY\n-----END RSA PRIVATE KEY-----'
            : '-----BEGIN CERTIFICATE-----\nMOCK_CERTIFICATE\n-----END CERTIFICATE-----'
        }
      });
    })
  })),
  GetParameterCommand: jest.fn().mockImplementation((input) => ({ input }))
}));

const getMockOvpnGeneratorEvent = (
  overrides?: Partial<OvpnGeneratorEvent>
): OvpnGeneratorEvent => {
  return {
    RequestType: 'Create',
    ResponseURL: 'https://example.com/response',
    StackId: 'arn:aws:cloudformation:us-east-1:123456789012:stack/test-stack',
    RequestId: 'test-request-id',
    ResourceType: 'AWS::CloudFormation::CustomResource',
    LogicalResourceId: 'TestResource',
    ResourceProperties: {
      ClientVpnEndpointId: 'cvpn-endpoint-12345',
      CertificateResourceId: 'certificate-generator-12345',
      Config: {
        clientCidr: '10.0.0.0/16',
        serverPort: 443,
        protocol: 'udp',
        splitTunnel: true
      }
    },
    ...overrides
  };
};

describe('OVPN Generator Lambda Edge Cases', () => {
  it('should handle when AWS returns undefined ClientVpnEndpoints', async () => {
    const { handler } = require('../../lib/lambdas/ovpn-generator');
    const event = getMockOvpnGeneratorEvent();

    const result = (await handler(event)) as OvpnGeneratorResult;

    expect(result.Status).toBe('FAILED');
    expect(result.Reason).toBe('No Client VPN endpoints found');
    expect(result.PhysicalResourceId).toBe('ovpn-generator-failed');
  });
});

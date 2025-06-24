import * as crypto from 'crypto';
import {
  OvpnGeneratorEvent,
  OvpnGeneratorResult
} from '../../lib/lambdas/ovpn-generator/types';

// Mock AWS SDK with undefined ClientVpnEndpoints
jest.mock('aws-sdk', () => ({
  EC2: jest.fn().mockImplementation(() => ({
    describeClientVpnEndpoints: jest.fn().mockImplementation(() => ({
      promise: jest.fn().mockResolvedValue({
        ClientVpnEndpoints: undefined // This triggers the || [] fallback
      })
    }))
  })),
  SecretsManager: jest.fn().mockImplementation(() => ({
    createSecret: jest.fn().mockImplementation(() => ({
      promise: jest.fn().mockResolvedValue({
        ARN:
          'arn:aws:secretsmanager:us-east-1:123456789012:secret:ovpn-file-' +
          crypto.randomUUID()
      })
    }))
  })),
  SSM: jest.fn().mockImplementation(() => ({
    getParameter: jest.fn().mockImplementation((params: { Name: string }) => ({
      promise: jest.fn().mockResolvedValue({
        Parameter: {
          Value: params.Name.includes('private-key')
            ? '-----BEGIN RSA PRIVATE KEY-----\nMOCK_PRIVATE_KEY\n-----END RSA PRIVATE KEY-----'
            : '-----BEGIN CERTIFICATE-----\nMOCK_CERTIFICATE\n-----END CERTIFICATE-----'
        }
      })
    }))
  })),
  config: {
    update: jest.fn()
  }
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

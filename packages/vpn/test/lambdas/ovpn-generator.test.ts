import * as crypto from 'crypto';
import { handler } from '../../lib/lambdas/ovpn-generator';
import {
  OvpnGeneratorEvent,
  OvpnGeneratorResult
} from '../../lib/lambdas/ovpn-generator/types';

// Mock AWS SDK v3
jest.mock('@aws-sdk/client-ec2', () => ({
  EC2Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({
      ClientVpnEndpoints: [
        {
          ClientVpnEndpointId: 'cvpn-endpoint-12345',
          DnsName: 'cvpn-endpoint-12345.prod.clientvpn.us-east-1.amazonaws.com',
          Status: { Code: 'available' }
        }
      ]
    })
  })),
  DescribeClientVpnEndpointsCommand: jest
    .fn()
    .mockImplementation(input => input)
}));

jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({
      ARN:
        'arn:aws:secretsmanager:us-east-1:123456789012:secret:ovpn-file-' +
        crypto.randomUUID()
    })
  })),
  CreateSecretCommand: jest.fn().mockImplementation(input => input)
}));

jest.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockImplementation(command => {
      const paramName = command.input?.Name ?? '';
      return Promise.resolve({
        Parameter: {
          Value:
            paramName.includes('private-key') === true
              ? '-----BEGIN RSA PRIVATE KEY-----\nMOCK_PRIVATE_KEY\n-----END RSA PRIVATE KEY-----'
              : '-----BEGIN CERTIFICATE-----\nMOCK_CERTIFICATE\n-----END CERTIFICATE-----'
        }
      });
    })
  })),
  GetParameterCommand: jest.fn().mockImplementation(input => ({ input }))
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

describe('OVPN Generator Lambda', () => {
  it('should generate valid .ovpn file with real VPN endpoint DNS', async () => {
    const event = getMockOvpnGeneratorEvent();

    const result = (await handler(event)) as OvpnGeneratorResult;

    expect(result.Status).toBe('SUCCESS');
    expect(result.Data).toBeDefined();
    expect(result.Data.OvpnFileContent).toBeDefined();
    expect(result.Data.OvpnSecretArn).toMatch(/^arn:aws:secretsmanager:/);

    // Validate .ovpn file structure
    const ovpnContent = result.Data.OvpnFileContent;
    expect(ovpnContent).toContain('client');
    expect(ovpnContent).toContain('dev tun');
    expect(ovpnContent).toContain('proto udp');
    expect(ovpnContent).toContain(
      'remote cvpn-endpoint-12345.prod.clientvpn.us-east-1.amazonaws.com 443'
    );
    expect(ovpnContent).toContain('resolv-retry infinite');
    expect(ovpnContent).toContain('nobind');
    expect(ovpnContent).toContain('persist-key');
    expect(ovpnContent).toContain('persist-tun');
    expect(ovpnContent).toContain('remote-cert-tls server');
  });

  it('should embed certificates in .ovpn file', async () => {
    const event = getMockOvpnGeneratorEvent();

    const result = (await handler(event)) as OvpnGeneratorResult;

    const ovpnContent = result.Data.OvpnFileContent;

    // Check for embedded CA certificate
    expect(ovpnContent).toContain('<ca>');
    expect(ovpnContent).toContain('</ca>');
    expect(ovpnContent).toContain('-----BEGIN CERTIFICATE-----');
    expect(ovpnContent).toContain('-----END CERTIFICATE-----');

    // Check for embedded client certificate
    expect(ovpnContent).toContain('<cert>');
    expect(ovpnContent).toContain('</cert>');

    // Check for embedded client private key
    expect(ovpnContent).toContain('<key>');
    expect(ovpnContent).toContain('</key>');
    expect(
      ovpnContent.includes('-----BEGIN RSA PRIVATE KEY-----') ||
        ovpnContent.includes('-----BEGIN PRIVATE KEY-----')
    ).toBe(true);
    expect(
      ovpnContent.includes('-----END RSA PRIVATE KEY-----') ||
        ovpnContent.includes('-----END PRIVATE KEY-----')
    ).toBe(true);
  });

  it('should use configurable VPN settings', async () => {
    const customConfig = {
      clientCidr: '192.168.0.0/24',
      serverPort: 1194,
      protocol: 'tcp' as const,
      splitTunnel: false
    };

    const event = getMockOvpnGeneratorEvent({
      ResourceProperties: {
        ClientVpnEndpointId: 'cvpn-endpoint-12345',
        CertificateResourceId: 'certificate-generator-12345',
        Config: customConfig
      }
    });

    const result = (await handler(event)) as OvpnGeneratorResult;

    expect(result.Status).toBe('SUCCESS');

    const ovpnContent = result.Data.OvpnFileContent;
    expect(ovpnContent).toContain('proto tcp');
    expect(ovpnContent).toContain(
      'remote cvpn-endpoint-12345.prod.clientvpn.us-east-1.amazonaws.com 1194'
    );

    // When split tunnel is disabled, should have redirect-gateway
    expect(ovpnContent).toContain('redirect-gateway def1');
  });

  it('should handle split tunnel configuration', async () => {
    const event = getMockOvpnGeneratorEvent({
      ResourceProperties: {
        ClientVpnEndpointId: 'cvpn-endpoint-12345',
        CertificateResourceId: 'certificate-generator-12345',
        Config: {
          clientCidr: '10.0.0.0/16',
          serverPort: 443,
          protocol: 'udp',
          splitTunnel: true
        }
      }
    });

    const result = (await handler(event)) as OvpnGeneratorResult;

    const ovpnContent = result.Data.OvpnFileContent;

    // When split tunnel is enabled, should NOT have redirect-gateway
    expect(ovpnContent).not.toContain('redirect-gateway def1');
  });

  it('should fetch real VPN endpoint DNS from AWS', async () => {
    const event = getMockOvpnGeneratorEvent();

    const result = (await handler(event)) as OvpnGeneratorResult;

    expect(result.Status).toBe('SUCCESS');

    // Should use the real DNS name from AWS API response
    const ovpnContent = result.Data.OvpnFileContent;
    expect(ovpnContent).toContain(
      'remote cvpn-endpoint-12345.prod.clientvpn.us-east-1.amazonaws.com'
    );
  });

  it('should store .ovpn file in Secrets Manager', async () => {
    const event = getMockOvpnGeneratorEvent();

    const result = (await handler(event)) as OvpnGeneratorResult;

    expect(result.Status).toBe('SUCCESS');
    expect(result.Data.OvpnSecretArn).toBeDefined();
    expect(result.Data.OvpnSecretArn).toMatch(/^arn:aws:secretsmanager:/);
  });

  it('should handle delete requests gracefully', async () => {
    const event = getMockOvpnGeneratorEvent({
      RequestType: 'Delete',
      PhysicalResourceId: 'existing-resource-id'
    });

    const result = (await handler(event)) as OvpnGeneratorResult;

    expect(result.Status).toBe('SUCCESS');
    expect(result.PhysicalResourceId).toBe('existing-resource-id');
  });

  it('should handle delete requests without PhysicalResourceId', async () => {
    const event = getMockOvpnGeneratorEvent({
      RequestType: 'Delete'
    });

    // Remove PhysicalResourceId to test the fallback
    delete (event as any).PhysicalResourceId;

    const result = (await handler(event)) as OvpnGeneratorResult;

    expect(result.Status).toBe('SUCCESS');
    expect(result.PhysicalResourceId).toBe('ovpn-generator-deleted');
  });

  it('should handle unknown error types in catch block', async () => {
    // Mock extractVpnEndpointDns to throw a non-Error object
    const ovpnUtils = require('../../lib/lambdas/ovpn-generator/ovpn-utils');
    const originalExtractVpnEndpointDns = ovpnUtils.extractVpnEndpointDns;
    ovpnUtils.extractVpnEndpointDns = jest.fn().mockImplementation(() => {
      throw 'This is a string error, not an Error object'; // Non-Error throw
    });

    const event = getMockOvpnGeneratorEvent();

    const result = (await handler(event)) as OvpnGeneratorResult;

    expect(result.Status).toBe('FAILED');
    expect(result.Reason).toBe('Unknown error');
    expect(result.PhysicalResourceId).toBe('ovpn-generator-failed');

    // Restore original function
    ovpnUtils.extractVpnEndpointDns = originalExtractVpnEndpointDns;
  });

  it('should handle error case without PhysicalResourceId', async () => {
    // Mock to throw error
    const ovpnUtils = require('../../lib/lambdas/ovpn-generator/ovpn-utils');
    const originalExtractVpnEndpointDns = ovpnUtils.extractVpnEndpointDns;
    ovpnUtils.extractVpnEndpointDns = jest.fn().mockImplementation(() => {
      throw new Error('Test error for PhysicalResourceId branch');
    });

    const event = getMockOvpnGeneratorEvent();
    // Remove PhysicalResourceId to test the fallback in error case
    delete (event as any).PhysicalResourceId;

    const result = (await handler(event)) as OvpnGeneratorResult;

    expect(result.Status).toBe('FAILED');
    expect(result.Reason).toBe('Test error for PhysicalResourceId branch');
    expect(result.PhysicalResourceId).toBe('ovpn-generator-failed');

    // Restore original function
    ovpnUtils.extractVpnEndpointDns = originalExtractVpnEndpointDns;
  });

  it('should validate VPN endpoint exists and is available', async () => {
    const event = getMockOvpnGeneratorEvent();

    const result = (await handler(event)) as OvpnGeneratorResult;

    expect(result.Status).toBe('SUCCESS');

    // Should successfully generate .ovpn file when endpoint is available
    expect(result.Data.OvpnFileContent).toBeDefined();
  });
});

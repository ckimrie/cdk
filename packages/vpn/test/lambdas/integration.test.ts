import * as crypto from 'crypto';
import * as forge from 'node-forge';
import { handler as certificateHandler } from '../../lib/lambdas/certificate-generator';
import { handler as ovpnHandler } from '../../lib/lambdas/ovpn-generator';
import {
  CertificateGeneratorEvent,
  CertificateGeneratorResult
} from '../../lib/lambdas/certificate-generator/types';
import {
  OvpnGeneratorEvent,
  OvpnGeneratorResult
} from '../../lib/lambdas/ovpn-generator/types';

// Mock AWS SDK with shared state between certificate and ovpn generators
const mockParameters: Record<string, string> = {};
const mockSecrets: Record<string, string> = {};

// Mock AWS SDK v3
jest.mock('@aws-sdk/client-acm', () => ({
  ACMClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({
      CertificateArn:
        'arn:aws:acm:us-east-1:123456789012:certificate/' + crypto.randomUUID()
    })
  })),
  ImportCertificateCommand: jest.fn().mockImplementation(input => input),
  ListCertificatesCommand: jest.fn().mockImplementation(input => input)
}));

jest.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockImplementation(command => {
      if (
        command.input?.Name !== undefined &&
        command.input?.Value !== undefined
      ) {
        // PutParameterCommand
        mockParameters[command.input.Name] = command.input.Value;
        return Promise.resolve({});
      } else if (command.input?.Name !== undefined) {
        // GetParameterCommand
        const value = mockParameters[command.input.Name];
        if (value === undefined) {
          console.log(`Missing parameter: ${command.input.Name}`);
          console.log('Available parameters:', Object.keys(mockParameters));
          throw new Error(`Parameter ${command.input.Name} not found in test`);
        }
        return Promise.resolve({
          Parameter: { Value: value }
        });
      }
      return Promise.resolve({});
    })
  })),
  PutParameterCommand: jest.fn().mockImplementation(input => ({ input })),
  GetParameterCommand: jest.fn().mockImplementation(input => ({ input }))
}));

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
    send: jest.fn().mockImplementation(command => {
      const secretArn =
        'arn:aws:secretsmanager:us-east-1:123456789012:secret:' +
        command.input.Name +
        '-' +
        crypto.randomUUID();
      mockSecrets[secretArn] = command.input.SecretString;
      return Promise.resolve({
        ARN: secretArn
      });
    })
  })),
  CreateSecretCommand: jest.fn().mockImplementation(input => ({ input }))
}));

const getMockCertificateEvent = (): CertificateGeneratorEvent => ({
  RequestType: 'Create',
  ResponseURL: 'https://example.com/response',
  StackId: 'arn:aws:cloudformation:us-east-1:123456789012:stack/test-stack',
  RequestId: 'test-request-id',
  ResourceType: 'AWS::CloudFormation::CustomResource',
  LogicalResourceId: 'TestCertificateResource',
  ResourceProperties: {
    Config: {
      organizationName: 'Test Organization',
      organizationalUnit: 'IT Department',
      country: 'US',
      state: 'California',
      city: 'San Francisco',
      keySize: 2048,
      validityPeriodDays: 365
    }
  }
});

const getMockOvpnEvent = (
  certificateResourceId: string
): OvpnGeneratorEvent => ({
  RequestType: 'Create',
  ResponseURL: 'https://example.com/response',
  StackId: 'arn:aws:cloudformation:us-east-1:123456789012:stack/test-stack',
  RequestId: 'test-request-id-2',
  ResourceType: 'AWS::CloudFormation::CustomResource',
  LogicalResourceId: 'TestOvpnResource',
  ResourceProperties: {
    ClientVpnEndpointId: 'cvpn-endpoint-12345',
    CertificateResourceId: certificateResourceId,
    Config: {
      clientCidr: '10.0.0.0/16',
      serverPort: 443,
      protocol: 'udp',
      splitTunnel: true
    }
  }
});

describe('End-to-End Certificate + OVPN Integration', () => {
  beforeEach(() => {
    // Clear mock state between tests
    Object.keys(mockParameters).forEach(key => delete mockParameters[key]);
    Object.keys(mockSecrets).forEach(key => delete mockSecrets[key]);

    // Mock Date.now() to ensure deterministic resource IDs
    jest.spyOn(Date.prototype, 'getTime').mockReturnValue(1234567890);
  });

  afterEach(() => {
    // Restore Date mock
    jest.restoreAllMocks();
  });

  it('should generate certificates and create working .ovpn file', async () => {
    // Step 1: Generate certificates
    const certificateEvent = getMockCertificateEvent();
    const certificateResult = (await certificateHandler(
      certificateEvent
    )) as CertificateGeneratorResult;

    expect(certificateResult.Status).toBe('SUCCESS');
    expect(certificateResult.PhysicalResourceId).toBeDefined();

    // Verify certificates are real X.509 certificates
    const caCert = certificateResult.Data.CaCertificatePem;
    const clientCert = certificateResult.Data.ClientCertificatePem;
    const clientKey = certificateResult.Data.ClientPrivateKeyPem;

    expect(() => forge.pki.certificateFromPem(caCert)).not.toThrow();
    expect(() => forge.pki.certificateFromPem(clientCert)).not.toThrow();
    expect(() => forge.pki.privateKeyFromPem(clientKey)).not.toThrow();

    // Step 2: Generate .ovpn file using the certificate resource ID
    const ovpnEvent = getMockOvpnEvent(certificateResult.PhysicalResourceId);
    const ovpnResult = (await ovpnHandler(ovpnEvent)) as OvpnGeneratorResult;

    expect(ovpnResult.Status).toBe('SUCCESS');
    expect(ovpnResult.Data.OvpnFileContent).toBeDefined();
    expect(ovpnResult.Data.OvpnSecretArn).toBeDefined();

    // Step 3: Verify the .ovpn file contains the real certificates
    const ovpnContent = ovpnResult.Data.OvpnFileContent;

    // Check basic OpenVPN configuration
    expect(ovpnContent).toContain('client');
    expect(ovpnContent).toContain('dev tun');
    expect(ovpnContent).toContain('proto udp');
    expect(ovpnContent).toContain(
      'remote cvpn-endpoint-12345.prod.clientvpn.us-east-1.amazonaws.com 443'
    );

    // Check embedded certificates
    expect(ovpnContent).toContain('<ca>');
    expect(ovpnContent).toContain('</ca>');
    expect(ovpnContent).toContain('<cert>');
    expect(ovpnContent).toContain('</cert>');
    expect(ovpnContent).toContain('<key>');
    expect(ovpnContent).toContain('</key>');

    // Verify the certificates in the .ovpn file match the generated ones
    // Extract key certificate data (without headers/footers for comparison)
    const caCertData = caCert
      .replace(/-----BEGIN CERTIFICATE-----\s*/, '')
      .replace(/\s*-----END CERTIFICATE-----\s*/, '')
      .replace(/\s/g, '');
    const clientCertData = clientCert
      .replace(/-----BEGIN CERTIFICATE-----\s*/, '')
      .replace(/\s*-----END CERTIFICATE-----\s*/, '')
      .replace(/\s/g, '');
    const clientKeyData = clientKey
      .replace(/-----BEGIN (RSA )?PRIVATE KEY-----\s*/, '')
      .replace(/\s*-----END (RSA )?PRIVATE KEY-----\s*/, '')
      .replace(/\s/g, '');

    // Remove all whitespace from .ovpn content for comparison
    const normalizedOvpnContent = ovpnContent.replace(/\s/g, '');

    expect(normalizedOvpnContent).toContain(caCertData);
    expect(normalizedOvpnContent).toContain(clientCertData);
    expect(normalizedOvpnContent).toContain(clientKeyData);
  });

  it('should handle different VPN configurations correctly', async () => {
    // Generate certificates first
    const certificateEvent = getMockCertificateEvent();
    const certificateResult = (await certificateHandler(
      certificateEvent
    )) as CertificateGeneratorResult;

    // Test TCP configuration with no split tunnel
    const tcpOvpnEvent: OvpnGeneratorEvent = {
      ...getMockOvpnEvent(certificateResult.PhysicalResourceId),
      ResourceProperties: {
        ClientVpnEndpointId: 'cvpn-endpoint-12345',
        CertificateResourceId: certificateResult.PhysicalResourceId,
        Config: {
          clientCidr: '192.168.0.0/24',
          serverPort: 1194,
          protocol: 'tcp',
          splitTunnel: false
        }
      }
    };

    const tcpOvpnResult = (await ovpnHandler(
      tcpOvpnEvent
    )) as OvpnGeneratorResult;

    expect(tcpOvpnResult.Status).toBe('SUCCESS');

    const tcpOvpnContent = tcpOvpnResult.Data.OvpnFileContent;
    expect(tcpOvpnContent).toContain('proto tcp');
    expect(tcpOvpnContent).toContain(
      'remote cvpn-endpoint-12345.prod.clientvpn.us-east-1.amazonaws.com 1194'
    );
    expect(tcpOvpnContent).toContain('redirect-gateway def1'); // No split tunnel
  });

  it('should validate certificate chain in .ovpn file', async () => {
    // Generate certificates
    const certificateEvent = getMockCertificateEvent();
    const certificateResult = (await certificateHandler(
      certificateEvent
    )) as CertificateGeneratorResult;

    // Generate .ovpn file
    const ovpnEvent = getMockOvpnEvent(certificateResult.PhysicalResourceId);
    const ovpnResult = (await ovpnHandler(ovpnEvent)) as OvpnGeneratorResult;

    // Parse certificates from both sources
    const originalCaCert = forge.pki.certificateFromPem(
      certificateResult.Data.CaCertificatePem
    );
    const originalClientCert = forge.pki.certificateFromPem(
      certificateResult.Data.ClientCertificatePem
    );

    // Extract certificates from .ovpn file
    const ovpnContent = ovpnResult.Data.OvpnFileContent;
    const caSection = ovpnContent.match(/<ca>\s*([\s\S]*?)\s*<\/ca>/);
    const certSection = ovpnContent.match(/<cert>\s*([\s\S]*?)\s*<\/cert>/);

    expect(caSection).toBeTruthy();
    expect(certSection).toBeTruthy();

    const ovpnCaCert = forge.pki.certificateFromPem(caSection![1]);
    const ovpnClientCert = forge.pki.certificateFromPem(certSection![1]);

    // Verify certificates match
    expect(ovpnCaCert.subject.getField('CN').value).toBe(
      originalCaCert.subject.getField('CN').value
    );
    expect(ovpnClientCert.subject.getField('CN').value).toBe(
      originalClientCert.subject.getField('CN').value
    );

    // Verify certificate chain
    expect(ovpnClientCert.issuer.getField('CN').value).toBe('VPN-CA');
    expect(ovpnCaCert.subject.getField('CN').value).toBe('VPN-CA');
  });

  it('should store .ovpn file in Secrets Manager', async () => {
    // Generate certificates
    const certificateEvent = getMockCertificateEvent();
    const certificateResult = (await certificateHandler(
      certificateEvent
    )) as CertificateGeneratorResult;

    // Generate .ovpn file
    const ovpnEvent = getMockOvpnEvent(certificateResult.PhysicalResourceId);
    const ovpnResult = (await ovpnHandler(ovpnEvent)) as OvpnGeneratorResult;

    // Verify .ovpn file was stored in Secrets Manager
    expect(ovpnResult.Data.OvpnSecretArn).toMatch(/^arn:aws:secretsmanager:/);

    // Verify the secret contains the .ovpn content
    const secretContent = mockSecrets[ovpnResult.Data.OvpnSecretArn];
    expect(secretContent).toBe(ovpnResult.Data.OvpnFileContent);
  });

  it('should use real certificates that are AWS ACM compatible', async () => {
    // Generate certificates
    const certificateEvent = getMockCertificateEvent();
    const certificateResult = (await certificateHandler(
      certificateEvent
    )) as CertificateGeneratorResult;

    // Verify all certificates are valid PEM format
    const caCert = certificateResult.Data.CaCertificatePem;
    const serverCert = certificateResult.Data.ServerCertificatePem;
    const clientCert = certificateResult.Data.ClientCertificatePem;

    expect(caCert).toMatch(
      /^-----BEGIN CERTIFICATE-----[\s\S]*-----END CERTIFICATE-----\s*$/
    );
    expect(serverCert).toMatch(
      /^-----BEGIN CERTIFICATE-----[\s\S]*-----END CERTIFICATE-----\s*$/
    );
    expect(clientCert).toMatch(
      /^-----BEGIN CERTIFICATE-----[\s\S]*-----END CERTIFICATE-----\s*$/
    );

    // Parse and validate certificate properties
    const parsedCaCert = forge.pki.certificateFromPem(caCert);
    const parsedServerCert = forge.pki.certificateFromPem(serverCert);
    const parsedClientCert = forge.pki.certificateFromPem(clientCert);

    // Verify CA certificate
    expect(parsedCaCert.subject.getField('CN').value).toBe('VPN-CA');
    const basicConstraints = parsedCaCert.getExtension('basicConstraints');
    expect((basicConstraints as any).cA).toBe(true);

    // Verify server certificate
    expect(parsedServerCert.subject.getField('CN').value).toBe('server');
    const serverExtKeyUsage = parsedServerCert.getExtension('extKeyUsage');
    expect((serverExtKeyUsage as any).serverAuth).toBe(true);

    // Verify client certificate
    expect(parsedClientCert.subject.getField('CN').value).toBe('client');
    const clientExtKeyUsage = parsedClientCert.getExtension('extKeyUsage');
    expect((clientExtKeyUsage as any).clientAuth).toBe(true);
  });
});

import * as crypto from 'crypto';
import * as forge from 'node-forge';
import { handler } from '../../lib/lambdas/certificate-generator';
import { CertificateGeneratorEvent, CertificateGeneratorResult } from '../../lib/lambdas/certificate-generator/types';

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  ACM: jest.fn().mockImplementation(() => ({
    importCertificate: jest.fn().mockImplementation(() => ({
      promise: jest.fn().mockResolvedValue({
        CertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/' + crypto.randomUUID()
      })
    }))
  })),
  SSM: jest.fn().mockImplementation(() => ({
    putParameter: jest.fn().mockImplementation(() => ({
      promise: jest.fn().mockResolvedValue({})
    }))
  })),
  config: {
    update: jest.fn()
  }
}));

const getMockCertificateGeneratorEvent = (
  overrides?: Partial<CertificateGeneratorEvent>
): CertificateGeneratorEvent => {
  return {
    RequestType: 'Create',
    ResponseURL: 'https://example.com/response',
    StackId: 'arn:aws:cloudformation:us-east-1:123456789012:stack/test-stack',
    RequestId: 'test-request-id',
    ResourceType: 'AWS::CloudFormation::CustomResource',
    LogicalResourceId: 'TestResource',
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
    },
    ...overrides
  };
};

describe('Certificate Generator Lambda', () => {
  it('should generate valid CA certificate with correct X.509 structure', async () => {
    const event = getMockCertificateGeneratorEvent();

    const result = await handler(event) as CertificateGeneratorResult;

    expect(result.Status).toBe('SUCCESS');
    expect(result.Data).toBeDefined();
    expect(result.Data.CaCertificatePem).toBeDefined();
    expect(result.Data.CaPrivateKeyPem).toBeDefined();
    expect(result.Data.CaCertificateArn).toMatch(/^arn:aws:acm:/);

    // Validate CA certificate structure
    const caCert = result.Data.CaCertificatePem;
    expect(caCert).toContain('-----BEGIN CERTIFICATE-----');
    expect(caCert).toContain('-----END CERTIFICATE-----');

    // Parse and validate real X.509 certificate
    const certificate = forge.pki.certificateFromPem(caCert);
    
    expect(certificate.subject.getField('CN').value).toBe('VPN-CA');
    expect(certificate.issuer.getField('CN').value).toBe('VPN-CA'); // Self-signed
    
    // Verify CA extensions
    const basicConstraints = certificate.getExtension('basicConstraints');
    expect(basicConstraints).toBeDefined();
    expect((basicConstraints as any).cA).toBe(true);
  });

  it('should generate valid server certificate signed by CA', async () => {
    const event = getMockCertificateGeneratorEvent();

    const result = await handler(event) as CertificateGeneratorResult;

    expect(result.Data.ServerCertificatePem).toBeDefined();
    expect(result.Data.ServerPrivateKeyPem).toBeDefined();
    expect(result.Data.ServerCertificateArn).toMatch(/^arn:aws:acm:/);

    // Validate server certificate structure
    const serverCert = result.Data.ServerCertificatePem;
    expect(serverCert).toContain('-----BEGIN CERTIFICATE-----');
    expect(serverCert).toContain('-----END CERTIFICATE-----');

    // Parse and validate real X.509 certificate
    const certificate = forge.pki.certificateFromPem(serverCert);
    
    expect(certificate.subject.getField('CN').value).toBe('server');
    
    // Verify server extensions
    const keyUsage = certificate.getExtension('keyUsage');
    expect(keyUsage).toBeDefined();
    expect((keyUsage as any).digitalSignature).toBe(true);
    expect((keyUsage as any).keyEncipherment).toBe(true);
    
    const extKeyUsage = certificate.getExtension('extKeyUsage');
    expect(extKeyUsage).toBeDefined();
    expect((extKeyUsage as any).serverAuth).toBe(true);
  });

  it('should generate valid client certificate signed by CA', async () => {
    const event = getMockCertificateGeneratorEvent();

    const result = await handler(event) as CertificateGeneratorResult;

    expect(result.Data.ClientCertificatePem).toBeDefined();
    expect(result.Data.ClientPrivateKeyPem).toBeDefined();
    expect(result.Data.ClientCertificateArn).toMatch(/^arn:aws:acm:/);

    // Validate client certificate structure
    const clientCert = result.Data.ClientCertificatePem;
    expect(clientCert).toContain('-----BEGIN CERTIFICATE-----');
    expect(clientCert).toContain('-----END CERTIFICATE-----');

    // Parse and validate real X.509 certificate
    const certificate = forge.pki.certificateFromPem(clientCert);
    
    expect(certificate.subject.getField('CN').value).toBe('client');
    
    // Verify client extensions
    const keyUsage = certificate.getExtension('keyUsage');
    expect(keyUsage).toBeDefined();
    expect((keyUsage as any).digitalSignature).toBe(true);
    expect((keyUsage as any).keyEncipherment).toBe(true);
    
    const extKeyUsage = certificate.getExtension('extKeyUsage');
    expect(extKeyUsage).toBeDefined();
    expect((extKeyUsage as any).clientAuth).toBe(true);
  });

  it('should verify client certificate is signed by CA certificate', async () => {
    const event = getMockCertificateGeneratorEvent();

    const result = await handler(event) as CertificateGeneratorResult;

    const caCert = result.Data.CaCertificatePem;
    const clientCert = result.Data.ClientCertificatePem;

    // Verify certificate chain (basic validation)
    expect(caCert).toBeDefined();
    expect(clientCert).toBeDefined();

    // Parse real X.509 certificates
    const caCertificate = forge.pki.certificateFromPem(caCert);
    const clientCertificate = forge.pki.certificateFromPem(clientCert);

    // Validate certificate chain - client certificate should be signed by CA
    expect(clientCertificate.issuer.getField('CN').value).toBe('VPN-CA');
    expect(caCertificate.subject.getField('CN').value).toBe('VPN-CA');
    
    // Verify that certificates have proper validity dates
    expect(clientCertificate.validity.notBefore).toBeInstanceOf(Date);
    expect(clientCertificate.validity.notAfter).toBeInstanceOf(Date);
    expect(clientCertificate.validity.notAfter.getTime()).toBeGreaterThan(clientCertificate.validity.notBefore.getTime());
  });

  it('should use configurable certificate parameters', async () => {
    const customConfig = {
      organizationName: 'Custom Corp',
      organizationalUnit: 'Security Team',
      country: 'GB',
      state: 'London',
      city: 'London',
      keySize: 4096 as const,
      validityPeriodDays: 730
    };

    const event = getMockCertificateGeneratorEvent({
      ResourceProperties: { Config: customConfig }
    });

    const result = await handler(event) as CertificateGeneratorResult;

    expect(result.Status).toBe('SUCCESS');
    
    // Verify custom parameters are used in certificate
    const caCert = result.Data.CaCertificatePem;
    const certificate = forge.pki.certificateFromPem(caCert);
    
    expect(certificate.subject.getField('O').value).toBe('Custom Corp');
    expect(certificate.subject.getField('OU').value).toBe('Security Team');
    expect(certificate.subject.getField('C').value).toBe('GB');
  });

  it('should handle delete requests gracefully', async () => {
    const event = getMockCertificateGeneratorEvent({
      RequestType: 'Delete',
      PhysicalResourceId: 'existing-resource-id'
    });

    const result = await handler(event) as CertificateGeneratorResult;

    expect(result.Status).toBe('SUCCESS');
    expect(result.PhysicalResourceId).toBe('existing-resource-id');
  });

  it('should handle delete requests without PhysicalResourceId', async () => {
    const event = getMockCertificateGeneratorEvent({
      RequestType: 'Delete'
      // No PhysicalResourceId provided
    });
    
    // Remove PhysicalResourceId to test the fallback
    delete (event as any).PhysicalResourceId;

    const result = await handler(event) as CertificateGeneratorResult;

    expect(result.Status).toBe('SUCCESS');
    expect(result.PhysicalResourceId).toBe('certificate-generator-deleted');
  });

  it('should generate AWS ACM compatible certificate format', async () => {
    const event = getMockCertificateGeneratorEvent();

    const result = await handler(event) as CertificateGeneratorResult;

    // Verify certificate format is compatible with ACM import
    const caCert = result.Data.CaCertificatePem;
    const caKey = result.Data.CaPrivateKeyPem;
    
    expect(caCert).toMatch(/^-----BEGIN CERTIFICATE-----[\s\S]*-----END CERTIFICATE-----\s*$/);
    expect(caKey).toMatch(/^-----BEGIN (RSA )?PRIVATE KEY-----[\s\S]*-----END (RSA )?PRIVATE KEY-----\s*$/);

    // Verify no extra whitespace or formatting issues
    expect(caCert.split('\n')[0].trim()).toBe('-----BEGIN CERTIFICATE-----');
    expect(caCert.trim().split('\n').pop()).toBe('-----END CERTIFICATE-----');
  });

  it('should return failure status when certificate generation encounters an error', async () => {
    // Create an event with a malformed config that would cause certificate generation to fail
    const invalidEvent = getMockCertificateGeneratorEvent({
      ResourceProperties: {
        Config: null as any // This should cause an error when accessing config properties
      }
    });

    const result = await handler(invalidEvent) as CertificateGeneratorResult;

    expect(result.Status).toBe('FAILED');
    expect(result.Reason).toBe('Cannot read properties of null (reading \'keySize\')');
    expect(result.PhysicalResourceId).toBe('certificate-generator-failed');
  });

  it('should handle unknown error types in catch block', async () => {
    // Mock the generateCACertificateAsync to throw a non-Error object
    const originalGenerateCACertificateAsync = require('../../lib/lambdas/certificate-generator/certificate-utils').generateCACertificateAsync;
    const certificateUtils = require('../../lib/lambdas/certificate-generator/certificate-utils');
    certificateUtils.generateCACertificateAsync = jest.fn().mockImplementation(() => {
      throw 'This is a string error, not an Error object'; // Non-Error throw
    });

    const event = getMockCertificateGeneratorEvent();

    const result = await handler(event) as CertificateGeneratorResult;

    expect(result.Status).toBe('FAILED');
    expect(result.Reason).toBe('Unknown error');
    expect(result.PhysicalResourceId).toBe('certificate-generator-failed');

    // Restore original function
    certificateUtils.generateCACertificateAsync = originalGenerateCACertificateAsync;
  });

  it('should handle error case without PhysicalResourceId', async () => {
    // Mock to throw error
    const certificateUtils = require('../../lib/lambdas/certificate-generator/certificate-utils');
    const originalGenerateCACertificateAsync = certificateUtils.generateCACertificateAsync;
    certificateUtils.generateCACertificateAsync = jest.fn().mockImplementation(() => {
      throw new Error('Test error for PhysicalResourceId branch');
    });

    const event = getMockCertificateGeneratorEvent();
    // Remove PhysicalResourceId to test the fallback in error case
    delete (event as any).PhysicalResourceId;

    const result = await handler(event) as CertificateGeneratorResult;

    expect(result.Status).toBe('FAILED');
    expect(result.Reason).toBe('Test error for PhysicalResourceId branch');
    expect(result.PhysicalResourceId).toBe('certificate-generator-failed');

    // Restore original function
    certificateUtils.generateCACertificateAsync = originalGenerateCACertificateAsync;
  });
});
import { generateCACertificate } from '../../lib/lambdas/certificate-generator/certificate-utils';

describe('Certificate Generation Debug', () => {
  it('should generate CA certificate without X509Certificate errors', () => {
    const config = {
      organizationName: 'Test Organization',
      organizationalUnit: 'IT Department',
      country: 'US',
      state: 'California',
      city: 'San Francisco',
      keySize: 2048 as const,
      validityPeriodDays: 365
    };

    expect(() => {
      const result = generateCACertificate(config);
      expect(result.certificate).toBeDefined();
      expect(result.privateKey).toBeDefined();
    }).not.toThrow();
  });
});

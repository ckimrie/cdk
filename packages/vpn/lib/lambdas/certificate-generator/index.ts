import { CertificateGeneratorEvent, CertificateGeneratorResult } from './types';
import { generateCACertificateAsync } from './certificate-utils';

export const handler = async (
  event: CertificateGeneratorEvent
): Promise<CertificateGeneratorResult> => {
  try {
    if (event.RequestType === 'Delete') {
      return {
        Status: 'SUCCESS',
        PhysicalResourceId:
          event.PhysicalResourceId || 'certificate-generator-deleted'
      } as CertificateGeneratorResult;
    }

    const { Config } = event.ResourceProperties;
    const certificates = await generateCACertificateAsync(Config);

    return {
      Status: 'SUCCESS',
      PhysicalResourceId: `certificate-generator-${new Date().getTime()}`,
      Data: certificates
    };
  } catch (error: unknown) {
    return {
      Status: 'FAILED',
      Reason: error instanceof Error ? error.message : 'Unknown error',
      PhysicalResourceId:
        event.PhysicalResourceId || 'certificate-generator-failed'
    } as CertificateGeneratorResult;
  }
};

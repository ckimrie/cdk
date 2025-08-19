import { CertificateGeneratorEvent, CertificateGeneratorResult } from './types';
import { generateCACertificateAsync } from './certificate-utils';

export const handler = async (
  event: CertificateGeneratorEvent
): Promise<CertificateGeneratorResult> => {
  console.log('Certificate Generator Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    if (event.RequestType === 'Delete') {
      console.log('Processing DELETE request');
      return {
        Status: 'SUCCESS',
        PhysicalResourceId:
          event.PhysicalResourceId || 'certificate-generator-deleted'
      } as CertificateGeneratorResult;
    }

    console.log('Processing CREATE/UPDATE request');
    const { Config } = event.ResourceProperties;
    
    if (!Config) {
      throw new Error('Missing Config in ResourceProperties');
    }
    
    console.log('Certificate configuration:', JSON.stringify(Config, null, 2));
    
    const certificates = await generateCACertificateAsync(Config);

    const result: CertificateGeneratorResult = {
      Status: 'SUCCESS',
      PhysicalResourceId: `certificate-generator-${new Date().getTime()}`,
      Data: certificates
    };
    
    console.log('Lambda execution completed successfully');
    console.log('Result data keys:', Object.keys(certificates));
    
    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    
    console.error('Lambda execution failed:');
    console.error('Error message:', errorMessage);
    console.error('Error stack:', errorStack);
    console.error('Event that caused error:', JSON.stringify(event, null, 2));
    
    return {
      Status: 'FAILED',
      Reason: errorMessage,
      PhysicalResourceId:
        event.PhysicalResourceId || 'certificate-generator-failed'
    } as CertificateGeneratorResult;
  }
};

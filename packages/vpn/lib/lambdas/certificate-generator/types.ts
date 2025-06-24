export type CertificateConfig = {
  organizationName: string;
  organizationalUnit: string;
  country: string;
  state: string;
  city: string;
  keySize: 2048 | 4096;
  validityPeriodDays: number;
};

export type CertificateGeneratorEvent = {
  RequestType: 'Create' | 'Update' | 'Delete';
  ResponseURL: string;
  StackId: string;
  RequestId: string;
  ResourceType: string;
  LogicalResourceId: string;
  PhysicalResourceId?: string;
  ResourceProperties: {
    Config: CertificateConfig;
  };
};

export type CertificateGeneratorResult = {
  Status: 'SUCCESS' | 'FAILED';
  Reason?: string;
  PhysicalResourceId: string;
  Data: {
    CaCertificatePem: string;
    CaPrivateKeyPem: string;
    CaCertificateArn: string;
    ServerCertificatePem: string;
    ServerPrivateKeyPem: string;
    ServerCertificateArn: string;
    ClientCertificatePem: string;
    ClientPrivateKeyPem: string;
    ClientCertificateArn: string;
  };
};
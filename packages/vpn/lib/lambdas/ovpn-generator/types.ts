export type OvpnConfig = {
  clientCidr: string;
  serverPort: number;
  protocol: 'tcp' | 'udp';
  splitTunnel: boolean;
};

export type OvpnGeneratorEvent = {
  RequestType: 'Create' | 'Update' | 'Delete';
  ResponseURL: string;
  StackId: string;
  RequestId: string;
  ResourceType: string;
  LogicalResourceId: string;
  PhysicalResourceId?: string;
  ResourceProperties: {
    ClientVpnEndpointId: string;
    CertificateResourceId: string;
    Config: OvpnConfig;
  };
};

export type OvpnGeneratorResult = {
  Status: 'SUCCESS' | 'FAILED';
  Reason?: string;
  PhysicalResourceId: string;
  Data: {
    OvpnFileContent: string;
    OvpnSecretArn: string;
  };
};
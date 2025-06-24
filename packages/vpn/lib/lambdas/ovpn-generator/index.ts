import { OvpnGeneratorEvent, OvpnGeneratorResult } from './types';
import { extractVpnEndpointDns } from './ovpn-utils';
import * as AWS from 'aws-sdk';

const ec2 = new AWS.EC2();
const ssm = new AWS.SSM();
const secretsManager = new AWS.SecretsManager();

export const handler = async (event: OvpnGeneratorEvent): Promise<OvpnGeneratorResult> => {
  try {
    if (event.RequestType === 'Delete') {
      return {
        Status: 'SUCCESS',
        PhysicalResourceId: event.PhysicalResourceId || 'ovpn-generator-deleted'
      } as OvpnGeneratorResult;
    }

    const { ClientVpnEndpointId, CertificateResourceId, Config } = event.ResourceProperties;

    // Fetch VPN endpoint details
    const vpnEndpointResponse = await ec2.describeClientVpnEndpoints({
      ClientVpnEndpointIds: [ClientVpnEndpointId]
    }).promise();

    const vpnEndpointDns = extractVpnEndpointDns(vpnEndpointResponse.ClientVpnEndpoints || []);

    // Retrieve certificates from SSM
    const [caCertResponse, clientCertResponse, clientKeyResponse] = await Promise.all([
      ssm.getParameter({ Name: `/vpn/${CertificateResourceId}/ca-certificate` }).promise(),
      ssm.getParameter({ Name: `/vpn/${CertificateResourceId}/client-certificate` }).promise(),
      ssm.getParameter({ Name: `/vpn/${CertificateResourceId}/client-private-key`, WithDecryption: true }).promise()
    ]);

    const caCert = caCertResponse.Parameter!.Value!;
    const clientCert = clientCertResponse.Parameter!.Value!;
    const clientKey = clientKeyResponse.Parameter!.Value!;

    // Generate .ovpn file content
    const ovpnContent = generateOvpnConfig({
      vpnEndpointDns,
      config: Config,
      caCert,
      clientCert,
      clientKey
    });

    // Store .ovpn file in Secrets Manager
    const secretName = `vpn-config-${ClientVpnEndpointId}-${Date.now()}`;
    const secretResult = await secretsManager.createSecret({
      Name: secretName,
      SecretString: ovpnContent,
      Description: `OpenVPN configuration for Client VPN endpoint ${ClientVpnEndpointId}`
    }).promise();

    return {
      Status: 'SUCCESS',
      PhysicalResourceId: `ovpn-generator-${new Date().getTime()}`,
      Data: {
        OvpnFileContent: ovpnContent,
        OvpnSecretArn: secretResult.ARN!
      }
    };
  } catch (error: unknown) {
    return {
      Status: 'FAILED',
      Reason: error instanceof Error ? error.message : 'Unknown error',
      PhysicalResourceId: event.PhysicalResourceId || 'ovpn-generator-failed'
    } as OvpnGeneratorResult;
  }
};

type GenerateOvpnConfigOptions = {
  vpnEndpointDns: string;
  config: {
    clientCidr: string;
    serverPort: number;
    protocol: 'tcp' | 'udp';
    splitTunnel: boolean;
  };
  caCert: string;
  clientCert: string;
  clientKey: string;
};

const generateOvpnConfig = (options: GenerateOvpnConfigOptions): string => {
  const { vpnEndpointDns, config, caCert, clientCert, clientKey } = options;

  let ovpnContent = `client
dev tun
proto ${config.protocol}
remote ${vpnEndpointDns} ${config.serverPort}
resolv-retry infinite
nobind
persist-key
persist-tun
remote-cert-tls server
cipher AES-256-GCM
verb 3`;

  // Add redirect-gateway for full tunnel (when split tunnel is disabled)
  if (!config.splitTunnel) {
    ovpnContent += '\nredirect-gateway def1';
  }

  // Embed certificates
  ovpnContent += `

<ca>
${caCert}
</ca>

<cert>
${clientCert}
</cert>

<key>
${clientKey}
</key>`;

  return ovpnContent;
};
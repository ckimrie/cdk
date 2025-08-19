import { OvpnGeneratorEvent, OvpnGeneratorResult } from './types';
import { extractVpnEndpointDns } from './ovpn-utils';
import { EC2Client, DescribeClientVpnEndpointsCommand } from '@aws-sdk/client-ec2';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { SecretsManagerClient, CreateSecretCommand } from '@aws-sdk/client-secrets-manager';

const ec2 = new EC2Client({});
const ssm = new SSMClient({});
const secretsManager = new SecretsManagerClient({});

export const handler = async (
  event: OvpnGeneratorEvent
): Promise<OvpnGeneratorResult> => {
  try {
    if (event.RequestType === 'Delete') {
      return {
        Status: 'SUCCESS',
        PhysicalResourceId: event.PhysicalResourceId || 'ovpn-generator-deleted'
      } as OvpnGeneratorResult;
    }

    const { ClientVpnEndpointId, CertificateResourceId, Config } =
      event.ResourceProperties;

    // Fetch VPN endpoint details
    const vpnEndpointResponse = await ec2.send(
      new DescribeClientVpnEndpointsCommand({
        ClientVpnEndpointIds: [ClientVpnEndpointId]
      })
    );

    const vpnEndpointDns = extractVpnEndpointDns(
      vpnEndpointResponse.ClientVpnEndpoints || []
    );

    // Retrieve certificates from SSM
    const [caCertResponse, clientCertResponse, clientKeyResponse] =
      await Promise.all([
        ssm.send(
          new GetParameterCommand({
            Name: `/vpn/${CertificateResourceId}/ca-certificate`
          })
        ),
        ssm.send(
          new GetParameterCommand({
            Name: `/vpn/${CertificateResourceId}/client-certificate`
          })
        ),
        ssm.send(
          new GetParameterCommand({
            Name: `/vpn/${CertificateResourceId}/client-private-key`,
            WithDecryption: true
          })
        )
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
    const secretResult = await secretsManager.send(
      new CreateSecretCommand({
        Name: secretName,
        SecretString: ovpnContent,
        Description: `OpenVPN configuration for Client VPN endpoint ${ClientVpnEndpointId}`
      })
    );

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

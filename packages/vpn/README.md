# @ckimrie/vpn

[![npm version](https://badge.fury.io/js/@ckimrie%2Fvpn.svg)](https://badge.fury.io/js/@ckimrie%2Fvpn)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful AWS CDK construct library that simplifies AWS Client VPN setup with automatic certificate
management and client configuration generation.

## Features

- **Simplified VPN Setup**: Easy-to-use AWS Client VPN construct with sensible defaults
- **Automatic Certificate Management**: Generates and manages server and client certificates using
  CDK custom resources and Lambda functions
- **Certificate-Based Mutual Authentication**: Support for mutual TLS authentication with automatic
  certificate provisioning
- **Client Configuration Generation**: Automatically generates `.ovpn` files and stores them
  securely in AWS Secrets Manager
- **Production Ready**: Built for enterprise use cases with comprehensive error handling and logging

## Installation

```bash
npm install @ckimrie/vpn
```

## Prerequisites

- AWS CDK v2.194.0 or later
- An existing VPC where the Client VPN will be deployed
- Appropriate AWS IAM permissions for VPN, Lambda, and certificate management

## Quick Start

### Basic Usage

```typescript
import { Stack, StackProps } from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { ClientVpnWithCertificateAuth } from '@ckimrie/vpn';

export class MyVpnStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Use your existing VPC
    const vpc = Vpc.fromLookup(this, 'ExistingVpc', {
      vpcId: 'vpc-12345678'
    });

    // Create Client VPN with certificate-based authentication
    const clientVpn = new ClientVpnWithCertificateAuth(this, 'ClientVpn', {
      vpc: vpc
    });

    // The construct automatically:
    // 1. Generates CA and server certificates
    // 2. Creates the Client VPN endpoint
    // 3. Generates client certificates and .ovpn configuration
    // 4. Stores the .ovpn file securely in AWS Secrets Manager

    // Access the generated resources
    console.log('VPN Endpoint ID:', clientVpn.clientVpnEndpointId);
    console.log('OVPN File Secret ARN:', clientVpn.ovpnFileSecretArn);
  }
}
```

### Customized Configuration

```typescript
import { Stack, StackProps } from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { ClientVpnWithCertificateAuth } from '@ckimrie/vpn';

export class CustomVpnStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = Vpc.fromLookup(this, 'ExistingVpc', {
      vpcId: 'vpc-12345678'
    });

    const clientVpn = new ClientVpnWithCertificateAuth(this, 'CustomVpn', {
      vpc: vpc,
      certificateConfig: {
        organizationName: 'Acme Corporation',
        organizationalUnit: 'IT Department',
        country: 'US',
        state: 'California',
        city: 'San Francisco',
        keySize: 2048,
        validityPeriodDays: 365
      },
      ovpnFileConfig: {
        clientCidr: '10.100.0.0/16',
        serverPort: 1194,
        protocol: 'tcp',
        splitTunnel: false
      }
    });
  }
}
```

## Advanced Configuration

### Using Custom Root CA

If you have an existing root CA certificate and private key, you can use them instead of generating
new ones:

```typescript
import { Stack, StackProps } from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { ClientVpnWithCertificateAuth } from '@ckimrie/vpn';

export class CustomCaVpnStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = Vpc.fromLookup(this, 'ExistingVpc', {
      vpcId: 'vpc-12345678'
    });

    const clientVpn = new ClientVpnWithCertificateAuth(this, 'CustomCaVpn', {
      vpc: vpc,
      rootCa: {
        certificateArn:
          'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012',
        privateKeySecretArn:
          'arn:aws:secretsmanager:us-east-1:123456789012:secret:root-ca-private-key-AbCdEf'
      },
      ovpnFileConfig: {
        clientCidr: '192.168.0.0/16',
        serverPort: 443,
        protocol: 'udp',
        splitTunnel: true
      }
    });
  }
}
```

### Retrieving the .ovpn File

After deployment, you can retrieve the generated .ovpn file from AWS Secrets Manager:

```bash
# Using AWS CLI
aws secretsmanager get-secret-value \
  --secret-id "arn:aws:secretsmanager:us-east-1:123456789012:secret:vpn-ovpn-file-xyz" \
  --query SecretString \
  --output text > client.ovpn

# Using CDK outputs
```

```typescript
import { CfnOutput } from 'aws-cdk-lib';

// In your stack constructor
new CfnOutput(this, 'OvpnFileSecretArn', {
  value: clientVpn.ovpnFileSecretArn,
  description: 'ARN of the secret containing the .ovpn file'
});

new CfnOutput(this, 'ClientVpnEndpointId', {
  value: clientVpn.clientVpnEndpointId,
  description: 'ID of the Client VPN endpoint'
});
```

### Complete VPN Setup with Subnet Associations

While this construct creates the VPN endpoint and certificates, you'll need to add subnet
associations and authorization rules manually:

```typescript
import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import {
  Vpc,
  CfnClientVpnTargetNetworkAssociation,
  CfnClientVpnAuthorizationRule
} from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { ClientVpnWithCertificateAuth } from '@ckimrie/vpn';

export class CompleteVpnStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = Vpc.fromLookup(this, 'ExistingVpc', {
      vpcId: 'vpc-12345678'
    });

    const clientVpn = new ClientVpnWithCertificateAuth(this, 'ClientVpn', {
      vpc: vpc,
      certificateConfig: {
        organizationName: 'MyCompany',
        organizationalUnit: 'IT Department',
        country: 'US',
        state: 'California',
        city: 'San Francisco'
      },
      ovpnFileConfig: {
        clientCidr: '10.0.0.0/16',
        serverPort: 443,
        protocol: 'udp',
        splitTunnel: true
      }
    });

    // Associate VPN with private subnets
    vpc.privateSubnets.forEach((subnet, index) => {
      new CfnClientVpnTargetNetworkAssociation(this, `SubnetAssociation${index}`, {
        clientVpnEndpointId: clientVpn.clientVpnEndpointId,
        subnetId: subnet.subnetId
      });
    });

    // Add authorization rule to allow access to VPC
    new CfnClientVpnAuthorizationRule(this, 'VpcAccessRule', {
      clientVpnEndpointId: clientVpn.clientVpnEndpointId,
      targetNetworkCidr: vpc.vpcCidrBlock,
      description: 'Allow access to VPC resources'
    });

    // Add authorization rule for internet access (optional)
    new CfnClientVpnAuthorizationRule(this, 'InternetAccessRule', {
      clientVpnEndpointId: clientVpn.clientVpnEndpointId,
      targetNetworkCidr: '0.0.0.0/0',
      description: 'Allow internet access through VPN'
    });

    // Outputs for easy access
    new CfnOutput(this, 'VpnEndpointId', {
      value: clientVpn.clientVpnEndpointId,
      description: 'Client VPN Endpoint ID'
    });

    new CfnOutput(this, 'OvpnFileSecret', {
      value: clientVpn.ovpnFileSecretArn,
      description: 'ARN of the secret containing the .ovpn file'
    });
  }
}
```

## API Reference

### ClientVpnWithCertificateAuth

The main construct for creating AWS Client VPN endpoints with certificate-based authentication.

#### Props (`ClientVpnWithCertificateAuthProps`)

| Property            | Type                | Required | Description                                   |
| ------------------- | ------------------- | -------- | --------------------------------------------- |
| `vpc`               | `ec2.IVpc`          | Yes      | The VPC where the Client VPN will be deployed |
| `rootCa`            | `CustomRootCa`      | No       | Existing root CA certificate and private key  |
| `certificateConfig` | `CertificateConfig` | No       | Configuration for certificate generation      |
| `ovpnFileConfig`    | `OvpnFileConfig`    | No       | Configuration for the generated .ovpn file    |

#### Properties

- `clientVpnEndpointId: string` - The ID of the created Client VPN endpoint
- `ovpnFileSecretArn: string` - The ARN of the AWS Secrets Manager secret containing the .ovpn file

### Type Definitions

#### `CertificateConfig`

Configuration for certificate generation:

| Property             | Type                   | Default                   | Description                         |
| -------------------- | ---------------------- | ------------------------- | ----------------------------------- |
| `organizationName`   | `string`               | "Client VPN Organization" | Certificate organization name       |
| `organizationalUnit` | `string`               | "IT Department"           | Certificate organizational unit     |
| `country`            | `string`               | "US"                      | Certificate country code            |
| `state`              | `string`               | "California"              | Certificate state/province          |
| `city`               | `string`               | "San Francisco"           | Certificate city/locality           |
| `keySize`            | `2048 \| 3072 \| 4096` | `2048`                    | RSA key size in bits                |
| `validityPeriodDays` | `number`               | `365`                     | Certificate validity period in days |

#### `CustomRootCa`

Existing root CA configuration:

| Property              | Type     | Description                                       |
| --------------------- | -------- | ------------------------------------------------- |
| `certificateArn`      | `string` | ARN of the root CA certificate in ACM             |
| `privateKeySecretArn` | `string` | ARN of the root CA private key in Secrets Manager |

#### `OvpnFileConfig`

Configuration for the generated .ovpn file:

| Property      | Type             | Default       | Description                            |
| ------------- | ---------------- | ------------- | -------------------------------------- |
| `clientCidr`  | `string`         | "10.0.0.0/16" | CIDR block for VPN client IP addresses |
| `serverPort`  | `number`         | `443`         | VPN server port                        |
| `protocol`    | `'udp' \| 'tcp'` | "udp"         | VPN protocol                           |
| `splitTunnel` | `boolean`        | `true`        | Enable split tunneling                 |

## How It Works

The construct automates the complete setup of an AWS Client VPN with certificate-based
authentication:

1. **Certificate Generation**: Creates a root CA certificate and private key using OpenSSL in a
   Lambda function
2. **Certificate Import**: Imports the root CA certificate into AWS Certificate Manager (ACM)
3. **Server Certificate**: Generates and imports a server certificate signed by the root CA
4. **Client Certificates**: Generates client certificates and private keys for VPN access
5. **VPN Endpoint**: Creates the AWS Client VPN endpoint with the generated certificates
6. **Configuration File**: Generates a complete .ovpn configuration file with embedded certificates
7. **Secure Storage**: Stores the .ovpn file in AWS Secrets Manager for secure access

### Certificate Management

The construct automatically handles certificate lifecycle:

- **Algorithm**: RSA with configurable key sizes (2048, 3072, 4096 bits)
- **Generation**: Uses OpenSSL via AWS Lambda custom resource
- **Storage**:
  - Root CA and server certificates stored in AWS Certificate Manager (ACM)
  - Client certificates and private keys stored in AWS Systems Manager Parameter Store
  - Complete .ovpn file stored in AWS Secrets Manager
- **Security**: All private keys are encrypted at rest and only accessible through AWS IAM
  permissions

## Troubleshooting

### Common Issues

**Certificate Generation Fails**

- Ensure Lambda execution role has ACM permissions (`acm:ImportCertificate`,
  `acm:DescribeCertificate`)
- Check CloudWatch logs for the certificate generator Lambda function
- Verify OpenSSL execution in the Lambda environment

**VPN Endpoint Creation Fails**

- Check that the provided VPC exists and is accessible
- Ensure you have the necessary IAM permissions for EC2 Client VPN operations
- Verify the client CIDR block doesn't conflict with existing networks

**Cannot Retrieve .ovpn File**

- Ensure you have `secretsmanager:GetSecretValue` permissions for the secret
- Check that the secret ARN is correct (available in CloudFormation outputs)
- Verify the secret exists in the correct AWS region

**VPN Connection Issues**

- Ensure you've added subnet associations to the VPN endpoint
- Add authorization rules to allow access to desired networks
- Check security groups allow VPN traffic on required ports
- Verify DNS resolution is configured correctly

### Debugging

Check CloudWatch logs for the Lambda functions:

- `/aws/lambda/VpnCertificateGeneratorSingleton` - Certificate generation logs
- `/aws/lambda/VpnOvpnGeneratorSingleton` - .ovpn file generation logs

Example log inspection:

```bash
# View certificate generation logs
aws logs tail /aws/lambda/VpnCertificateGeneratorSingleton --follow

# View .ovpn generation logs
aws logs tail /aws/lambda/VpnOvpnGeneratorSingleton --follow
```

## Using the VPN

### Download and Install the .ovpn File

After deployment, retrieve your .ovpn file:

```bash
# Get the secret ARN from your CloudFormation stack outputs
OVPN_SECRET_ARN="arn:aws:secretsmanager:us-east-1:123456789012:secret:vpn-ovpn-file-xyz"

# Download the .ovpn file
aws secretsmanager get-secret-value \
  --secret-id "$OVPN_SECRET_ARN" \
  --query SecretString \
  --output text > client.ovpn
```

### Connect to the VPN

#### On macOS/Linux with OpenVPN

```bash
# Install OpenVPN (macOS with Homebrew)
brew install openvpn

# Connect to VPN
sudo openvpn --config client.ovpn
```

#### On Windows

1. Download and install [OpenVPN Connect](https://openvpn.net/client-connect-vpn-for-windows/)
2. Import the `client.ovpn` file
3. Connect to the VPN

#### On mobile devices

1. Install OpenVPN Connect app from your app store
2. Import the `client.ovpn` file
3. Connect to the VPN

### Important Notes

- **Subnet Associations**: Remember to associate your VPN endpoint with subnets using
  `CfnClientVpnTargetNetworkAssociation`
- **Authorization Rules**: Add authorization rules using `CfnClientVpnAuthorizationRule` to allow
  access to networks
- **Security**: The .ovpn file contains sensitive key material - store it securely and don't share
  it
- **Client Certificate**: Each .ovpn file contains a unique client certificate for individual user
  identification

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process
for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📁 [Issue Tracker](https://github.com/ckimrie/vpn/issues)
- 📖 [Documentation](https://github.com/ckimrie/vpn/wiki)
- 💬 [Discussions](https://github.com/ckimrie/vpn/discussions)

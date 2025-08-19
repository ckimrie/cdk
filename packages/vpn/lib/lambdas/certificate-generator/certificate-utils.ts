import * as forge from 'node-forge';
import { ACMClient, ImportCertificateCommand } from '@aws-sdk/client-acm';
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm';
import { CertificateConfig } from './types';

const acm = new ACMClient({});
const ssm = new SSMClient({});

export const generateCACertificate = (config: CertificateConfig) => {
  // Generate CA certificate
  const caKeys = forge.pki.rsa.generateKeyPair(config.keySize);
  const caCert = forge.pki.createCertificate();

  caCert.publicKey = caKeys.publicKey;
  caCert.serialNumber = '01';
  caCert.validity.notBefore = new Date();
  caCert.validity.notAfter = new Date();
  caCert.validity.notAfter.setDate(
    caCert.validity.notBefore.getDate() + config.validityPeriodDays
  );

  const caAttrs = [
    { type: '2.5.4.3', value: 'VPN-CA' }, // commonName
    { type: '2.5.4.10', value: config.organizationName }, // organizationName
    { type: '2.5.4.11', value: config.organizationalUnit }, // organizationalUnitName
    { type: '2.5.4.6', value: config.country }, // countryName
    { type: '2.5.4.8', value: config.state }, // stateOrProvinceName
    { type: '2.5.4.7', value: config.city } // localityName
  ];

  caCert.subject.attributes.push(...caAttrs);
  caCert.issuer.attributes.push(...caAttrs);

  caCert.setExtensions([
    {
      name: 'basicConstraints',
      cA: true
    }
  ]);

  caCert.sign(caKeys.privateKey);

  // Convert to PEM format
  const certificate = forge.pki.certificateToPem(caCert);
  const privateKey = forge.pki.privateKeyToPem(caKeys.privateKey);

  return {
    certificate,
    privateKey
  };
};

export const generateCACertificateAsync = async (config: CertificateConfig) => {
  // Generate CA certificate
  const caKeys = forge.pki.rsa.generateKeyPair(config.keySize);
  const caCert = forge.pki.createCertificate();

  caCert.publicKey = caKeys.publicKey;
  caCert.serialNumber = '01';
  caCert.validity.notBefore = new Date();
  caCert.validity.notAfter = new Date();
  caCert.validity.notAfter.setDate(
    caCert.validity.notBefore.getDate() + config.validityPeriodDays
  );

  const caAttrs = [
    { type: '2.5.4.3', value: 'VPN-CA' }, // commonName
    { type: '2.5.4.10', value: config.organizationName }, // organizationName
    { type: '2.5.4.11', value: config.organizationalUnit }, // organizationalUnitName
    { type: '2.5.4.6', value: config.country }, // countryName
    { type: '2.5.4.8', value: config.state }, // stateOrProvinceName
    { type: '2.5.4.7', value: config.city } // localityName
  ];

  caCert.subject.attributes.push(...caAttrs);
  caCert.issuer.attributes.push(...caAttrs);

  caCert.setExtensions([
    {
      name: 'basicConstraints',
      cA: true
    }
  ]);

  caCert.sign(caKeys.privateKey);

  // Generate server certificate
  const serverKeys = forge.pki.rsa.generateKeyPair(config.keySize);
  const serverCert = forge.pki.createCertificate();

  serverCert.publicKey = serverKeys.publicKey;
  serverCert.serialNumber = '02';
  serverCert.validity.notBefore = new Date();
  serverCert.validity.notAfter = new Date();
  serverCert.validity.notAfter.setDate(
    serverCert.validity.notBefore.getDate() + config.validityPeriodDays
  );

  const serverAttrs = [
    { type: '2.5.4.3', value: 'server' }, // commonName
    { type: '2.5.4.10', value: config.organizationName }, // organizationName
    { type: '2.5.4.11', value: config.organizationalUnit }, // organizationalUnitName
    { type: '2.5.4.6', value: config.country }, // countryName
    { type: '2.5.4.8', value: config.state }, // stateOrProvinceName
    { type: '2.5.4.7', value: config.city } // localityName
  ];

  serverCert.subject.attributes.push(...serverAttrs);
  serverCert.issuer.attributes.push(...caAttrs);

  serverCert.setExtensions([
    {
      name: 'basicConstraints',
      cA: false
    },
    {
      name: 'keyUsage',
      digitalSignature: true,
      keyEncipherment: true
    },
    {
      name: 'extKeyUsage',
      serverAuth: true
    }
  ]);

  serverCert.sign(caKeys.privateKey);

  // Generate client certificate
  const clientKeys = forge.pki.rsa.generateKeyPair(config.keySize);
  const clientCert = forge.pki.createCertificate();

  clientCert.publicKey = clientKeys.publicKey;
  clientCert.serialNumber = '03';
  clientCert.validity.notBefore = new Date();
  clientCert.validity.notAfter = new Date();
  clientCert.validity.notAfter.setDate(
    clientCert.validity.notBefore.getDate() + config.validityPeriodDays
  );

  const clientAttrs = [
    { type: '2.5.4.3', value: 'client' }, // commonName
    { type: '2.5.4.10', value: config.organizationName }, // organizationName
    { type: '2.5.4.11', value: config.organizationalUnit }, // organizationalUnitName
    { type: '2.5.4.6', value: config.country }, // countryName
    { type: '2.5.4.8', value: config.state }, // stateOrProvinceName
    { type: '2.5.4.7', value: config.city } // localityName
  ];

  clientCert.subject.attributes.push(...clientAttrs);
  clientCert.issuer.attributes.push(...caAttrs);

  clientCert.setExtensions([
    {
      name: 'basicConstraints',
      cA: false
    },
    {
      name: 'keyUsage',
      digitalSignature: true,
      keyEncipherment: true
    },
    {
      name: 'extKeyUsage',
      clientAuth: true
    }
  ]);

  clientCert.sign(caKeys.privateKey);

  // Convert to PEM format
  const caCertPem = forge.pki.certificateToPem(caCert);
  const caPrivateKeyPem = forge.pki.privateKeyToPem(caKeys.privateKey);
  const serverCertPem = forge.pki.certificateToPem(serverCert);
  const serverPrivateKeyPem = forge.pki.privateKeyToPem(serverKeys.privateKey);
  const clientCertPem = forge.pki.certificateToPem(clientCert);
  const clientPrivateKeyPem = forge.pki.privateKeyToPem(clientKeys.privateKey);

  // Import certificates to ACM
  const caImportResult = await acm.send(
    new ImportCertificateCommand({
      Certificate: Buffer.from(caCertPem),
      PrivateKey: Buffer.from(caPrivateKeyPem)
    })
  );

  const serverImportResult = await acm.send(
    new ImportCertificateCommand({
      Certificate: Buffer.from(serverCertPem),
      PrivateKey: Buffer.from(serverPrivateKeyPem)
    })
  );

  const clientImportResult = await acm.send(
    new ImportCertificateCommand({
      Certificate: Buffer.from(clientCertPem),
      PrivateKey: Buffer.from(clientPrivateKeyPem)
    })
  );

  // Store certificates in SSM for later use
  const resourceId = `certificate-generator-${new Date().getTime()}`;

  await Promise.all([
    ssm.send(
      new PutParameterCommand({
        Name: `/vpn/${resourceId}/ca-certificate`,
        Value: caCertPem,
        Type: 'String'
      })
    ),
    ssm.send(
      new PutParameterCommand({
        Name: `/vpn/${resourceId}/ca-private-key`,
        Value: caPrivateKeyPem,
        Type: 'SecureString'
      })
    ),
    ssm.send(
      new PutParameterCommand({
        Name: `/vpn/${resourceId}/client-certificate`,
        Value: clientCertPem,
        Type: 'String'
      })
    ),
    ssm.send(
      new PutParameterCommand({
        Name: `/vpn/${resourceId}/client-private-key`,
        Value: clientPrivateKeyPem,
        Type: 'SecureString'
      })
    )
  ]);

  // Validate that all certificate ARNs were returned
  if (!caImportResult.CertificateArn) {
    throw new Error('CA certificate import failed - no CertificateArn returned');
  }
  if (!serverImportResult.CertificateArn) {
    throw new Error('Server certificate import failed - no CertificateArn returned');
  }
  if (!clientImportResult.CertificateArn) {
    throw new Error('Client certificate import failed - no CertificateArn returned');
  }

  return {
    CaCertificatePem: caCertPem,
    CaPrivateKeyPem: caPrivateKeyPem,
    CaCertificateArn: caImportResult.CertificateArn,
    ServerCertificatePem: serverCertPem,
    ServerPrivateKeyPem: serverPrivateKeyPem,
    ServerCertificateArn: serverImportResult.CertificateArn,
    ClientCertificatePem: clientCertPem,
    ClientPrivateKeyPem: clientPrivateKeyPem,
    ClientCertificateArn: clientImportResult.CertificateArn
  };
};

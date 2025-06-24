export const extractVpnEndpointDns = (endpoints: any[]): string => {
  if (!endpoints || endpoints.length === 0) {
    throw new Error('No Client VPN endpoints found');
  }

  const endpoint = endpoints[0];

  if (!endpoint.Status || endpoint.Status.Code !== 'available') {
    throw new Error(
      `Client VPN endpoint is not available. Current status: ${
        endpoint.Status?.Code || 'undefined'
      }`
    );
  }

  if (!endpoint.DnsName || endpoint.DnsName === '') {
    throw new Error('Client VPN endpoint does not have a DNS name');
  }

  return endpoint.DnsName;
};

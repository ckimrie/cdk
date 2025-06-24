import { extractVpnEndpointDns } from '../../lib/lambdas/ovpn-generator/ovpn-utils';

describe('OVPN Utility Functions', () => {
  describe('extractVpnEndpointDns', () => {
    it('should extract DNS name from available VPN endpoint', () => {
      const endpoints = [{
        ClientVpnEndpointId: 'cvpn-endpoint-12345',
        Status: { Code: 'available' },
        DnsName: 'cvpn-endpoint-12345.prod.clientvpn.us-east-1.amazonaws.com'
      }];

      const dnsName = extractVpnEndpointDns(endpoints);

      expect(dnsName).toBe('cvpn-endpoint-12345.prod.clientvpn.us-east-1.amazonaws.com');
    });

    it('should throw error when no endpoints are provided', () => {
      expect(() => {
        extractVpnEndpointDns([]);
      }).toThrow('No Client VPN endpoints found');
    });

    it('should throw error when endpoints array is null', () => {
      expect(() => {
        extractVpnEndpointDns(null as any);
      }).toThrow('No Client VPN endpoints found');
    });

    it('should throw error when endpoints array is undefined', () => {
      expect(() => {
        extractVpnEndpointDns(undefined as any);
      }).toThrow('No Client VPN endpoints found');
    });

    it('should throw error when VPN endpoint is not available', () => {
      const endpoints = [{
        ClientVpnEndpointId: 'cvpn-endpoint-12345',
        Status: { Code: 'pending-associate' },
        DnsName: 'cvpn-endpoint-12345.prod.clientvpn.us-east-1.amazonaws.com'
      }];

      expect(() => {
        extractVpnEndpointDns(endpoints);
      }).toThrow('Client VPN endpoint is not available. Current status: pending-associate');
    });

    it('should throw error when VPN endpoint has no DNS name', () => {
      const endpoints = [{
        ClientVpnEndpointId: 'cvpn-endpoint-12345',
        Status: { Code: 'available' },
        DnsName: undefined
      }];

      expect(() => {
        extractVpnEndpointDns(endpoints);
      }).toThrow('Client VPN endpoint does not have a DNS name');
    });

    it('should throw error when VPN endpoint has empty DNS name', () => {
      const endpoints = [{
        ClientVpnEndpointId: 'cvpn-endpoint-12345',
        Status: { Code: 'available' },
        DnsName: ''
      }];

      expect(() => {
        extractVpnEndpointDns(endpoints);
      }).toThrow('Client VPN endpoint does not have a DNS name');
    });

    it('should handle endpoint without status field', () => {
      const endpoints = [{
        ClientVpnEndpointId: 'cvpn-endpoint-12345',
        Status: undefined,
        DnsName: 'cvpn-endpoint-12345.prod.clientvpn.us-east-1.amazonaws.com'
      }];

      expect(() => {
        extractVpnEndpointDns(endpoints);
      }).toThrow('Client VPN endpoint is not available. Current status: undefined');
    });
  });
});
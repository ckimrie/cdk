---
"@ckimrie/cdk-vpn": minor
---

feat: Add optional client CIDR range parameter to ClientVpnWithCertificateAuth construct

- Add clientCidrBlock optional parameter to ClientVpnWithCertificateAuthProps
- Default to '10.0.0.0/16' for backward compatibility  
- Both VPN endpoint and OVPN configuration use the same configurable CIDR block
- Comprehensive test coverage for default and custom CIDR scenarios
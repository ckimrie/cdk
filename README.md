# @ckimrie/cdk

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A collection of AWS CDK constructs for common use cases, developed from real-world experience working with AWS CDK.

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [@ckimrie/cdk-vpn](./packages/vpn) | [![npm version](https://badge.fury.io/js/@ckimrie%2Fcdk-vpn.svg)](https://badge.fury.io/js/@ckimrie%2Fcdk-vpn) | AWS Client VPN construct with automatic certificate management |

## Quick Start

### Installation

```bash
# Install individual packages as needed
npm install @ckimrie/cdk-vpn

# Or with pnpm
pnpm add @ckimrie/cdk-vpn
```

### Usage

Each package is self-contained with its own documentation. See the individual package README files for detailed usage instructions.

```typescript
// Example: Using the VPN construct
import { ClientVpnWithCertificateAuth } from '@ckimrie/cdk-vpn';

const vpn = new ClientVpnWithCertificateAuth(this, 'VPN', {
  vpc: myVpc
});
```

## Development

This is a monorepo managed with [pnpm workspaces](https://pnpm.io/workspaces).

### Prerequisites

- Node.js 18+ LTS
- pnpm 8+
- AWS CDK v2.194.0+

### Setup

```bash
# Clone the repository
git clone https://github.com/ckimrie/vpn.git
cd vpn

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run tests with coverage (100% required)
pnpm test:coverage
```

### Development Workflow

```bash
# Work on a specific package
pnpm --filter @ckimrie/cdk-vpn build
pnpm --filter @ckimrie/cdk-vpn test

# Or use convenience scripts
pnpm vpn:build
pnpm vpn:test:coverage

# Format and lint all packages
pnpm format
pnpm lint
```

### Project Structure

```
.
├── packages/
│   ├── vpn/                    # @ckimrie/cdk-vpn
│   │   ├── lib/               # Source code
│   │   ├── test/              # Tests (100% coverage required)
│   │   ├── package.json       # Package config
│   │   └── README.md          # Package documentation
│   └── [future packages]
├── pnpm-workspace.yaml        # Workspace configuration
├── package.json               # Root package config
└── README.md                  # This file
```

## Development Standards

This project follows strict development practices:

- **Test-Driven Development (TDD)**: All code must be written in response to failing tests
- **100% Test Coverage**: No exceptions across all metrics (branches, functions, lines, statements)
- **TypeScript Strict Mode**: Full type safety with no `any` types
- **Functional Programming**: Immutable data, pure functions, composition over inheritance
- **Self-Documenting Code**: Clear naming instead of comments

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

## CI/CD

This repository features **fully automated CI/CD** based on conventional commits:

1. **Create PR** with conventional commit messages
2. **Merge PR** to main branch  
3. **Automatic Release** happens based on your commit types

No manual changeset creation needed! See [CI_CD_SETUP.md](./CI_CD_SETUP.md) for details.

## Contributing

We welcome contributions! Please read our [Contributing Guidelines](./CONTRIBUTING.md) for details on:

- Code quality requirements
- Testing standards
- Development workflow
- Pull request process

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📁 [Issue Tracker](https://github.com/ckimrie/vpn/issues)
- 💬 [Discussions](https://github.com/ckimrie/vpn/discussions)
- 📖 [Documentation](https://github.com/ckimrie/vpn/wiki)
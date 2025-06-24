# Contributing to @ckimrie/cdk

Thank you for your interest in contributing to the @ckimrie/cdk monorepo! This document
provides guidelines and information for contributors working on our collection of AWS CDK constructs.

## Code of Conduct

This project adheres to a standard of respectful collaboration. All contributors are expected to
uphold this standard in all interactions.

## Getting Started

### Prerequisites

- Node.js 18+ LTS
- pnpm 8+ (required for workspace management)
- AWS CDK v2.194.0+
- Git

### Development Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/your-username/cdk.git
   cd cdk
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Verify setup**
   ```bash
   pnpm build
   pnpm test:coverage
   pnpm lint
   ```

## Development Standards

### Code Quality Requirements

This project enforces strict code quality standards:

- **TypeScript**: All code must be written in TypeScript with strict mode enabled
- **ESLint**: Code must pass all ESLint rules without warnings
- **Prettier**: Code must be formatted according to Prettier configuration
- **Test Coverage**: **100% coverage** across all metrics (branches, functions, lines, statements)
- **Test-Driven Development**: All production code must be written in response to a failing test

### Coding Standards

#### TypeScript Configuration

This project follows strict TypeScript practices as defined in CLAUDE.md:

- **Strict mode enabled**: All TypeScript strict mode options are enforced
- **No `any` types**: Use `unknown` if type is truly unknown
- **No type assertions**: Avoid `as SomeType` unless absolutely necessary with clear justification
- **Prefer `type` over `interface`**: Use `type` for all definitions
- **Functional programming principles**: Immutable data, pure functions, composition over inheritance
- **Schema-first development**: Use Zod or similar for runtime validation and type derivation

#### Naming Conventions

- **Classes/Types**: PascalCase (e.g., `ClientVpnWithCertificateAuth`)
- **Types**: PascalCase with descriptive names (e.g., `ClientVpnWithCertificateAuthProps`)
- **Functions**: camelCase, verb-based (e.g., `generateOvpnFile`, `validatePayment`)
- **Variables**: camelCase for configuration, descriptive names
- **Constants**: UPPER_SNAKE_CASE for true constants, camelCase for configuration
- **Files**: kebab-case (e.g., `client-vpn-with-certificate-auth.ts`)

#### Code Organization

Following functional programming principles:

- **Small, pure functions**: Functions should be focused on a single responsibility
- **Immutable data**: No data mutation - use immutable data structures
- **Composition over inheritance**: Prefer function composition
- **Early returns**: Use guard clauses instead of deep nesting (max 2 levels)
- **No comments in code**: Code should be self-documenting through clear naming
- **Options objects**: Use options objects for function parameters instead of positional parameters

### Commit Standards

This project uses [Conventional Commits](https://conventionalcommits.org/) specification.

#### Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

#### Types

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring without feature changes
- `test`: Test additions or modifications
- `chore`: Build process, tooling changes

#### Examples

```bash
feat(client-vpn): add support for custom security groups
fix(certificates): resolve OpenSSL key generation timeout
docs(readme): update installation instructions
test(client-vpn): add integration tests for directory service auth
chore(deps): update AWS CDK to v2.194.0
```

## Development Workflow

### Branch Strategy

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Individual feature branches
- `hotfix/*`: Critical bug fixes

### Pull Request Process

1. **Create Feature Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Write code following the standards above
   - Add/update tests for your changes
   - Update documentation as needed

3. **Verify Quality**

   ```bash
   pnpm lint             # Check code quality across all packages
   pnpm format:check     # Verify formatting
   pnpm test:coverage    # Ensure 100% coverage
   pnpm build            # Verify compilation
   
   # Or for specific package:
   pnpm --filter @ckimrie/cdk-vpn lint
   pnpm --filter @ckimrie/cdk-vpn test:coverage
   ```

4. **Commit Changes**

   ```bash
   git add .
   git commit -m "feat(scope): your descriptive message"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Pull Request Requirements

Your PR must meet these requirements:

- ✅ All CI checks pass
- ✅ **Code coverage = 100%** (no exceptions)
- ✅ No ESLint warnings or errors
- ✅ Code properly formatted with Prettier
- ✅ Conventional commit message format
- ✅ **All code written using TDD** (tests written first)
- ✅ Tests focus on behavior, not implementation
- ✅ Documentation updated if applicable
- ✅ No breaking changes without major version bump

### Review Process

1. **Automated Checks**: CI pipeline runs tests, linting, and coverage
2. **Code Review**: Maintainer reviews code quality and design
3. **Testing**: Changes tested in isolation and integration
4. **Approval**: At least one maintainer approval required
5. **Merge**: Squash and merge with conventional commit message

## Testing Guidelines

### Test-Driven Development (TDD)

**CRITICAL**: This project follows strict TDD practices as defined in CLAUDE.md:

1. **Red**: Write a failing test for the desired behavior
2. **Green**: Write the minimum code to make the test pass
3. **Refactor**: Improve code structure while keeping tests green

### Test Structure

Current test organization:
```
packages/
├── vpn/
│   └── test/
│       ├── client-vpn-with-certificate-auth.test.ts    # Main construct tests
│       ├── client-vpn.test.ts                          # Legacy construct tests
│       └── lambdas/                                    # Lambda function tests
│           ├── certificate-generator.test.ts
│           ├── ovpn-generator.test.ts
│           ├── ovpn-utils.test.ts
│           └── integration.test.ts
└── [future packages with their own test directories]
```

### Testing Standards

#### Behavior-Driven Testing

- **Test behavior, not implementation**: Focus on what the code does, not how it does it
- **Use real types**: Import types from the actual codebase, never redefine them in tests
- **Mock factory pattern**: Use factory functions with optional overrides for test data
- **Descriptive test names**: Test names should describe the business behavior being tested

```typescript
// ✅ Good - Tests behavior through public API
describe('ClientVpnWithCertificateAuth', () => {
  it('should generate VPN endpoint with embedded certificates in ovpn file', () => {
    const vpc = new Vpc(stack, 'TestVpc');
    
    const vpn = new ClientVpnWithCertificateAuth(stack, 'TestVpn', { vpc });
    
    expect(vpn.clientVpnEndpointId).toBeDefined();
    expect(vpn.ovpnFileSecretArn).toBeDefined();
  });
});

// ❌ Bad - Tests implementation details
describe('ClientVpnWithCertificateAuth', () => {
  it('should call getCertificateGeneratorFunction method', () => {
    // This tests implementation, not behavior
  });
});
```

#### Test Data Factories

Use factory functions for consistent test data:

```typescript
const getMockCertificateConfig = (
  overrides?: Partial<CertificateConfig>
): CertificateConfig => ({
  organizationName: 'Test Org',
  country: 'US',
  state: 'CA',
  city: 'SF',
  keySize: 2048,
  validityPeriodDays: 365,
  ...overrides
});
```

#### Coverage Requirements

- **100% coverage** across all metrics (branches, functions, lines, statements)
- **No exceptions** to coverage requirements
- Tests must be based on business behavior, not implementation details
- Every edge case and error path must be tested

### Running Tests

```bash
# Run all tests across all packages
pnpm test

# Run with coverage (100% required)
pnpm test:coverage

# Run tests for specific package
pnpm --filter @ckimrie/cdk-vpn test
pnpm vpn:test:coverage

# Run specific test file in a package
cd packages/vpn && pnpm test -- client-vpn.test.ts

# Watch mode for a specific package
cd packages/vpn && pnpm test -- --watch
```

## Architecture and Technical Details

### Certificate Management

The construct uses Node.js forge library within AWS Lambda for certificate generation:

**Supported Algorithms:**

- RSA (2048, 3072, 4096 bits)
- Hash: SHA-256
- Extensions: Proper CA and end-entity certificate extensions

**Certificate Chain:**

1. Root CA Certificate (self-signed)
2. Server Certificate (signed by CA)
3. Client Certificates (signed by CA)

**Storage:**
- Root CA and server certificates stored in AWS Certificate Manager (ACM)
- Client certificates and private keys stored in AWS Systems Manager Parameter Store
- Complete .ovpn files stored in AWS Secrets Manager

### Lambda Function Requirements

- Runtime: Node.js 18+
- Dependencies: node-forge for certificate generation
- Proper IAM permissions for ACM, Parameter Store, and Secrets Manager
- Comprehensive error handling and logging
- Singleton pattern to avoid resource duplication across stacks

## Documentation Guidelines

### Code Documentation

Following the principle that code should be self-documenting:

- **No comments in code**: Use clear, descriptive names instead
- **JSDoc only for public APIs**: When generating external documentation
- **README updates**: Keep examples current and accurate
- **Type safety**: Use TypeScript types to document expected inputs/outputs

### README Updates

- Update examples when adding new features
- Keep API reference current
- Include troubleshooting for common issues

### CHANGELOG Maintenance

- Follow semantic versioning
- Document breaking changes clearly
- Include migration guides when needed

## Issue Reporting

### Bug Reports

Please include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node.js version, CDK version, etc.)
- Relevant logs or error messages

### Feature Requests

Please include:

- Use case description
- Proposed solution
- Alternative approaches considered
- Impact on existing functionality

### Issue Templates

Use the provided GitHub issue templates for consistency.

## Release Process

### Versioning

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Workflow

1. Update CHANGELOG.md
2. Update version in package.json
3. Create release tag
4. GitHub Actions handles npm publishing
5. Create release notes

## OVPN File Generation

### Configuration Options

The construct generates complete .ovpn files with:

- Embedded certificates and private keys
- Configurable server port and protocol (UDP/TCP)
- Split tunnel support
- Proper OpenVPN client directives

### Testing OVPN Generation

- Test file generation with various configurations
- Verify certificate embedding is correct
- Test error handling for missing certificates
- Validate OpenVPN configuration syntax

## Security Considerations

### Certificate Handling

- Never commit private keys or certificates
- Use AWS KMS for encryption at rest
- Implement proper key rotation
- Log certificate operations for audit

### Code Security

- No hardcoded credentials or secrets
- Validate all inputs
- Use secure random generation
- Follow AWS security best practices

## Performance Guidelines

### CDK Best Practices

- **Singleton pattern**: Lambda functions are created once per stack using singleton pattern
- **Efficient resource creation**: Minimize CloudFormation resource count
- **Proper dependencies**: Ensure correct resource dependency chains
- **Asset optimization**: Lambda assets are kept minimal

### Lambda Optimization

- **Memory allocation**: Certificate generator uses 512MB, OVPN generator uses 256MB
- **Timeout settings**: Appropriate timeouts for certificate operations (10 min) vs file generation (5 min)
- **Dependency management**: Use only necessary npm dependencies (node-forge)
- **Error handling**: Comprehensive error handling to avoid infinite retries

## Support and Communication

### Getting Help

- 📁 [Issue Tracker](https://github.com/ckimrie/vpn/issues)
- 💬 [Discussions](https://github.com/ckimrie/vpn/discussions)
- 📖 [Documentation](https://github.com/ckimrie/vpn/wiki)

### Response Times

- Bug reports: Best effort within 48 hours
- Feature requests: Reviewed weekly
- Security issues: Within 24 hours

Thank you for contributing to @ckimrie/cdk! Your efforts help make AWS CDK constructs more accessible to
developers worldwide.

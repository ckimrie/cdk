# CI/CD Setup Guide

This repository uses GitHub Actions for automated CI/CD with the following workflows:

## Workflows

### 1. CI (`.github/workflows/ci.yml`)
Runs on every push and pull request to `main`:
- **Format Check**: Prettier formatting verification
- **Lint**: ESLint code quality checks  
- **Type Check**: TypeScript compilation
- **Test**: Jest unit tests with 100% coverage requirement
- **CDK Synth**: Validates that CDK constructs can synthesize without errors

### 2. Release (`.github/workflows/release.yml`)
Runs on push to `main` branch:
- **Automated Versioning**: Uses changesets to determine version bumps based on conventional commits
- **NPM Publishing**: Publishes packages to NPM registry with proper provenance
- **GitHub Releases**: Creates GitHub releases with changelogs
- **Independent Versioning**: Each package is versioned independently

### 3. Dependency Updates (`.github/workflows/dependency-updates.yml`)
Runs weekly:
- **Automated Updates**: Updates all dependencies to latest versions
- **Test Validation**: Ensures tests still pass after updates
- **Pull Request**: Creates PR for review

## Required Secrets

Configure these secrets in your GitHub repository:

### NPM_TOKEN
1. Create an NPM access token at https://www.npmjs.com/settings/tokens
2. Add it as `NPM_TOKEN` in repository secrets
3. Ensure the token has publish permissions for your organization

### CODECOV_TOKEN (Optional)
1. Set up project at https://codecov.io
2. Add token as `CODECOV_TOKEN` for coverage reporting

## Usage

### Creating a Release

1. **Make Changes**: Develop your features following conventional commits
2. **Add Changeset**: Run `pnpm changeset` to document your changes
   ```bash
   pnpm changeset
   # Select affected packages
   # Choose version bump type (patch/minor/major)
   # Write clear description
   ```
3. **Commit**: Commit your changeset file
4. **Merge PR**: When PR is merged to main, release workflow runs automatically

### Package Versioning

Each package follows semantic versioning:
- **Patch** (0.1.0 → 0.1.1): Bug fixes, non-breaking changes
- **Minor** (0.1.0 → 0.2.0): New features, backward compatible
- **Major** (0.1.0 → 1.0.0): Breaking changes

### Conventional Commits

Use conventional commit format for automatic changelog generation:
```
feat(vpn): add custom CIDR range support
fix(vpn): resolve certificate generation issue
docs(vpn): update README with examples
chore: update dependencies
```

Scope should match package name for proper versioning.

## Local Development

### Prerequisites
- Node.js 18+
- pnpm 8+

### Setup
```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format
```

### CDK Synth Validation
```bash
cd test-app
pnpm install
npx cdk synth --all
```

## Package Publishing

Packages are automatically published to NPM when:
1. Changeset files exist in the repository
2. PR is merged to main branch
3. All CI checks pass

Published packages include:
- Compiled JavaScript (`lib/**/*.js`)
- TypeScript definitions (`lib/**/*.d.ts`)  
- README, LICENSE, and CHANGELOG files
- No test files or source TypeScript

## Troubleshooting

### CDK Synth Failures
- Ensure test-app dependencies are up to date
- Check that construct exports are correct
- Verify AWS CDK version compatibility

### Publishing Failures  
- Verify NPM_TOKEN has correct permissions
- Check package.json publish configuration
- Ensure version bump is greater than current published version

### Test Failures
- Run tests locally first: `pnpm test`
- Check test coverage requirements (100%)
- Verify all linting rules pass
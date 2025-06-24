# CI/CD Setup Guide

This repository uses GitHub Actions for **fully automated CI/CD** with the following workflows:

## 🚀 Fully Automatic Release Process

**You simply create PRs with conventional commits and merge them. Everything else is automatic!**

1. **Create PR** with conventional commit messages
2. **Merge PR** to main branch  
3. **Automatic Release** happens based on your commit messages

No manual changeset creation needed! 🎉

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
- **Auto-Changeset Generation**: Analyzes conventional commits and generates changesets automatically
- **Automated Versioning**: Determines version bumps based on commit types
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

### Creating a Release (Fully Automatic! 🎉)

1. **Make Changes**: Develop your features using conventional commit messages
2. **Create PR**: Push your branch and create a pull request
3. **Merge PR**: When PR is merged to main, the release workflow automatically:
   - Analyzes your conventional commits
   - Generates appropriate changesets
   - Versions packages based on commit types
   - Publishes to NPM
   - Creates GitHub releases

**No manual steps required!** Just use proper conventional commit format.

### Package Versioning

Each package follows semantic versioning:
- **Patch** (0.1.0 → 0.1.1): Bug fixes, non-breaking changes
- **Minor** (0.1.0 → 0.2.0): New features, backward compatible
- **Major** (0.1.0 → 1.0.0): Breaking changes

### Conventional Commits (Required for Automatic Releases)

Use conventional commit format to trigger automatic releases:

#### Format: `type(scope): description`

```bash
# Features (minor version bump)
feat(vpn): add custom CIDR range support
feat(vpn): add new authentication method

# Bug fixes (patch version bump)  
fix(vpn): resolve certificate generation issue
fix(vpn): fix VPC configuration bug

# Breaking changes (major version bump)
feat(vpn)!: remove deprecated authentication method
fix(vpn)!: change default CIDR range

# No release triggered
docs(vpn): update README with examples
chore: update dependencies
test(vpn): add integration tests
```

#### Scopes
- **vpn**: Changes to the VPN package (`@ckimrie/cdk-vpn`)
- **No scope**: Changes affecting all packages

#### Breaking Changes
Add `!` after the scope: `feat(vpn)!: breaking change`
Or include `BREAKING CHANGE:` in the commit body.

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
#!/usr/bin/env node

/**
 * Auto-changeset generator from conventional commits
 * Analyzes git commits since last release and generates appropriate changeset files
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get packages from workspace
function getWorkspacePackages() {
  try {
    const workspaceContent = fs.readFileSync('pnpm-workspace.yaml', 'utf8');
    
    const packageDirs = workspaceContent
      .split('\n')
      .filter(line => line.trim().startsWith('- '))
      .map(line => line.trim().substring(2).replace(/'/g, ''));
    
    const packages = [];
    for (const dir of packageDirs) {
      if (dir === 'test-app') continue; // Skip test app
      
      // Handle glob patterns like 'packages/*'
      if (dir.includes('*')) {
        const globPattern = dir;
        const baseDir = globPattern.replace('/*', '');
        
        if (fs.existsSync(baseDir)) {
          const subdirs = fs.readdirSync(baseDir);
          
          for (const subdir of subdirs) {
            const fullPath = path.join(baseDir, subdir);
            const packageJsonPath = path.join(fullPath, 'package.json');
            
            if (fs.existsSync(packageJsonPath)) {
              const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
              
              if (!packageJson.private) { // Only include publishable packages
                packages.push({
                  name: packageJson.name,
                  path: fullPath,
                  scope: getPackageScope(packageJson.name)
                });
              }
            }
          }
        }
      } else {
        // Direct directory path
        const packageJsonPath = path.join(dir, 'package.json');
        
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          
          if (!packageJson.private) { // Only include publishable packages
            packages.push({
              name: packageJson.name,
              path: dir,
              scope: getPackageScope(packageJson.name)
            });
          }
        }
      }
    }
    
    return packages;
  } catch (error) {
    console.error('Error reading workspace packages:', error.message);
    return [];
  }
}

// Extract scope from package name (e.g., @ckimrie/cdk-vpn -> vpn)
function getPackageScope(packageName) {
  if (packageName.includes('/')) {
    const parts = packageName.split('/');
    const lastPart = parts[parts.length - 1];
    // Remove 'cdk-' prefix if present
    return lastPart.startsWith('cdk-') ? lastPart.substring(4) : lastPart;
  }
  return packageName;
}

// Get the last release tag
function getLastReleaseTag() {
  try {
    // Get all tags sorted by version
    const tags = execSync('git tag --sort=-version:refname', { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(tag => tag.match(/^v?\d+\.\d+\.\d+/));
    
    return tags[0] || null;
  } catch (error) {
    console.log('No previous release tags found, analyzing all commits');
    return null;
  }
}

// Get commits since last release
function getCommitsSinceLastRelease(lastTag) {
  try {
    const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
    const commits = execSync(`git log ${range} --pretty=format:"%H|%s|%b" --no-merges`, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(line => line.length > 0)
      .map(line => {
        const [hash, subject, body] = line.split('|');
        return { hash, subject, body: body || '' };
      });
    
    return commits;
  } catch (error) {
    console.error('Error getting commits:', error.message);
    return [];
  }
}

// Parse conventional commit
function parseConventionalCommit(commitSubject) {
  // Regex for: type(scope): description
  // Also handles: type(scope)!: description for breaking changes
  const conventionalRegex = /^(\w+)(\(([^)]+)\))?(!)?: (.+)$/;
  const match = commitSubject.match(conventionalRegex);
  
  if (!match) {
    return null;
  }
  
  const [, type, , scope, breaking, description] = match;
  
  return {
    type,
    scope: scope || null,
    breaking: !!breaking,
    description
  };
}

// Determine version bump type
function getVersionBump(commits) {
  let hasBreaking = false;
  let hasFeature = false;
  let hasFix = false;
  
  for (const commit of commits) {
    const parsed = parseConventionalCommit(commit.subject);
    if (!parsed) continue;
    
    if (parsed.breaking || parsed.type === 'feat' && commit.body.includes('BREAKING CHANGE')) {
      hasBreaking = true;
    } else if (parsed.type === 'feat') {
      hasFeature = true;
    } else if (parsed.type === 'fix') {
      hasFix = true;
    }
  }
  
  if (hasBreaking) return 'major';
  if (hasFeature) return 'minor';
  if (hasFix) return 'patch';
  return null;
}

// Generate changeset content
function generateChangesetContent(packageName, versionBump, commits) {
  const relevantCommits = commits.filter(commit => {
    const parsed = parseConventionalCommit(commit.subject);
    return parsed && (parsed.scope === getPackageScope(packageName) || !parsed.scope);
  });
  
  if (relevantCommits.length === 0) {
    return null;
  }
  
  const frontmatter = `---\n"${packageName}": ${versionBump}\n---\n\n`;
  
  const description = relevantCommits
    .map(commit => {
      const parsed = parseConventionalCommit(commit.subject);
      if (parsed) {
        const prefix = parsed.breaking ? '⚠️ BREAKING:' : 
                      parsed.type === 'feat' ? '✨' :
                      parsed.type === 'fix' ? '🐛' : '📝';
        return `${prefix} ${parsed.description}`;
      }
      return `📝 ${commit.subject}`;
    })
    .join('\n');
  
  return frontmatter + description;
}

// Write changeset file
function writeChangesetFile(content) {
  const timestamp = Date.now();
  const filename = `auto-generated-${timestamp}.md`;
  const filepath = path.join('.changeset', filename);
  
  fs.writeFileSync(filepath, content);
  console.log(`Generated changeset: ${filename}`);
}

// Main function
function main() {
  console.log('🔍 Analyzing commits for automatic changeset generation...');
  
  // Get workspace packages
  const packages = getWorkspacePackages();
  if (packages.length === 0) {
    console.log('No publishable packages found');
    return;
  }
  
  console.log(`Found packages: ${packages.map(p => p.name).join(', ')}`);
  
  // Get commits since last release
  const lastTag = getLastReleaseTag();
  console.log(`Last release tag: ${lastTag || 'none'}`);
  
  const commits = getCommitsSinceLastRelease(lastTag);
  if (commits.length === 0) {
    console.log('No commits found since last release');
    return;
  }
  
  console.log(`Found ${commits.length} commits to analyze`);
  
  // Analyze commits by package scope
  const packageChanges = new Map();
  
  for (const commit of commits) {
    const parsed = parseConventionalCommit(commit.subject);
    if (!parsed) {
      console.log(`Skipping non-conventional commit: ${commit.subject}`);
      continue;
    }
    
    // Determine which packages are affected
    const affectedPackages = parsed.scope 
      ? packages.filter(pkg => pkg.scope === parsed.scope)
      : packages; // No scope = affects all packages
    
    for (const pkg of affectedPackages) {
      if (!packageChanges.has(pkg.name)) {
        packageChanges.set(pkg.name, []);
      }
      packageChanges.get(pkg.name).push(commit);
    }
  }
  
  // Generate changesets for each affected package
  let changesetGenerated = false;
  
  for (const [packageName, packageCommits] of packageChanges) {
    const versionBump = getVersionBump(packageCommits);
    if (!versionBump) {
      console.log(`No version bump needed for ${packageName}`);
      continue;
    }
    
    const changesetContent = generateChangesetContent(packageName, versionBump, packageCommits);
    if (changesetContent) {
      writeChangesetFile(changesetContent);
      changesetGenerated = true;
      console.log(`Generated ${versionBump} version bump for ${packageName}`);
    }
  }
  
  if (!changesetGenerated) {
    console.log('No changesets generated - no relevant changes found');
  } else {
    console.log('✅ Changeset generation complete');
  }
}

// Run the script
if (require.main === module) {
  main();
}
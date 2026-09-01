---
name: eliza-conventions
description: Development conventions and patterns for eliza. TypeScript Next.js project with mixed commits.
---

# Eliza Conventions

> Generated from [0xSoftBoi/eliza](https://github.com/0xSoftBoi/eliza) on 2026-09-01

## Overview

This skill teaches Claude the development patterns and conventions used in eliza.

## Tech Stack

- **Primary Language**: TypeScript
- **Framework**: Next.js
- **Architecture**: type-based module organization
- **Test Location**: mixed
- **Test Framework**: vitest

## When to Use This Skill

Activate this skill when:
- Making changes to this repository
- Adding new features following established patterns
- Writing tests that match project conventions
- Creating commits with proper message format

## Commit Conventions

Follow these commit message conventions based on 100 analyzed commits.

### Commit Style: Mixed Style

### Prefixes Used

- `fix`
- `test`
- `feat`
- `chore`
- `perf`

### Message Guidelines

- Average message length: ~68 characters
- Keep first line concise and descriptive
- Use imperative mood ("Add feature" not "Added feature")


*Commit message example*

```text
fix(cloud): enforce Hetzner lifecycle authority
```

*Commit message example*

```text
feat(cloud): add durable backup admission authority
```

*Commit message example*

```text
chore(cloud): shift backup admission migrations
```

*Commit message example*

```text
test(cloud): typecheck billing deletion coverage
```

*Commit message example*

```text
perf(core): tool turns that bypass the planner announce running_tool on the stream
```

*Commit message example*

```text
fix(cloud): compensate accepted Hetzner resources
```

*Commit message example*

```text
fix(cloud): classify standing from primary (#29493)
```

*Commit message example*

```text
fix(cloud): preserve billing receipts across deletion
```

## Architecture

### Project Structure: Monorepo

This project uses **type-based** module organization.

### Configuration Files

- `.github/workflows/activate-personal-shared-telegram-edge.yml`
- `.github/workflows/android-arm64-local-e2e.yml`
- `.github/workflows/app-live-e2e.yml`
- `.github/workflows/cloud-cf-deploy.yml`
- `.github/workflows/cloud-cf-release.yml`
- `.github/workflows/cloud-gateway-discord.yml`
- `.github/workflows/cloud-latency-certification.yml`
- `.github/workflows/cloud-tests.yml`
- `.github/workflows/database-identity-staging-report.yml`
- `.github/workflows/deploy-eliza-provisioning-worker.yml`
- `.github/workflows/deploy-gateway-webhook.yml`
- `.github/workflows/develop-full.yml`
- `.github/workflows/device-e2e.yml`
- `.github/workflows/personal-dedicated-rereview-staging.yml`
- `.github/workflows/pr-static-smoke.yml`
- `.github/workflows/voice-live-e2e.yml`
- `package.json`
- `packages/app-core/package.json`
- `packages/app-core/vitest.config.ts`
- `packages/app/vite.config.ts`
- `packages/cloud/api/package.json`
- `packages/cloud/api/wrangler.toml`
- `packages/cloud/services/_common/package.json`
- `.github/workflows/arm-headscale-control-plane.yml`
- `.github/workflows/deploy-tunnel-proxy.yml`
- `.github/workflows/codeql.yml`

### Guidelines

- Group code by type (components, services, utils)
- Keep related functionality in the same type folder
- Avoid circular dependencies between type folders

## Code Style

### Language: TypeScript

### Naming Conventions

| Element | Convention |
|---------|------------|
| Files | kebab-case |
| Functions | camelCase |
| Classes | PascalCase |
| Constants | SCREAMING_SNAKE_CASE |

### Import Style: Relative Imports

### Export Style: Named Exports


*Preferred import style*

```typescript
// Use relative imports
import { Button } from '../components/Button'
import { useAuth } from './hooks/useAuth'
```

*Preferred export style*

```typescript
// Use named exports
export function calculateTotal() { ... }
export const TAX_RATE = 0.1
export interface Order { ... }
```

## Testing

### Test Framework: vitest

### File Pattern: `*.test.ts`

### Test Types

- **Unit tests**: Test individual functions and components in isolation
- **Integration tests**: Test interactions between multiple components/services
- **E2e tests**: Test complete user flows through the application

### Mocking: vi.mock

### Coverage

This project has coverage reporting configured. Aim for 80%+ coverage.


*Test file structure*

```typescript
import { describe, it, expect } from 'vitest'

describe('MyFunction', () => {
  it('should return expected result', () => {
    const result = myFunction(input)
    expect(result).toBe(expected)
  })
})
```

## Error Handling

### Error Handling Style: Error Boundaries

This project uses **custom error classes** for specific error types.

React **Error Boundaries** are used for graceful UI error handling.


## Common Workflows

These workflows were detected from analyzing commit patterns.

### Database Migration

Database schema changes with migration files

**Frequency**: ~7 times per month

**Steps**:
1. Create migration file
2. Update schema definitions
3. Generate/update types

**Files typically involved**:
- `migrations/*`
- `**/schema.*`

**Example commit sequence**:
```
fix(connectors): isolate google oauth grants by role
feat(cloud): add durable backup admission authority
fix(android): keep chat above overlay keyboards
```


## Best Practices

Based on analysis of the codebase, follow these practices:

### Do

- Write tests using vitest
- Follow *.test.ts naming pattern
- Use kebab-case for file names
- Prefer named exports

### Don't

- Don't skip tests for new features
- Don't deviate from established patterns without discussion

---

*This skill was auto-generated by [ECC Tools](https://ecc.tools). Review and customize as needed for your team.*

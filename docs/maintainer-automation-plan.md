# Verifiable Maintainer Automation Plan

This document defines a narrow, auditable use of API credits for maintaining Clipboard Manager. It is a plan, not a claim that the automation is already deployed or that the project has broad adoption.

## Application-ready copy

The official [Codex for Open Source application](https://openai.com/form/codex-for-oss/) was checked on 2026-08-21. Each answer below stays within the form's 500-character limit.

**Why does this repository qualify? (426 characters)**

> Clipboard Manager is an actively maintained MIT-licensed Windows clipboard utility with an open-source Android companion. It has shipped dual-platform releases and maintains tests for Electron IPC, backup parsing, LAN pairing, private-network validation, secret hashing, revocation, and OTP filtering. The project gives users a local-first option for clipboard history and phone-to-PC transfer, with documented privacy limits.

**How will you use API credits? (481 characters)**

> API credits will power auditable maintainer automation: PR review drafts with file/line and CI citations; Electron IPC/preload and LAN-pairing security checks; focused dependency-upgrade PRs with upstream evidence and rollback notes; and Windows/Android release-QA checklists covering versions, tests, signing, artifact names, and hashes. No user clipboard data, pairing secrets, signing keys, or production credentials will be sent. All merges and releases require human approval.

**Anything else we should know? (386 characters)**

> Repository changes add desktop/Android CI, SECURITY and CONTRIBUTING policies, Issue/PR templates, runtime screenshots, an architecture diagram, and a privacy threat model. The automation design is documented in docs/maintainer-automation-plan.md. It separates build/test evidence from Windows/Android runtime and hardware proof and does not use stars or downloads as an adoption claim.

## Proposed workflows

| Workflow | Inputs | Verifiable output | Human gate |
|---|---|---|---|
| PR review assistance | PR diff, repository policy, CI results | Review draft with file/line citations, severity, and test gaps | Maintainer decides whether to post and merge |
| Electron security check | IPC/preload diff, CSP/window configuration, managed-path code | Checklist covering input validation, navigation denial, sandboxing, and path boundaries | Security-sensitive changes require maintainer review |
| LAN pairing security check | Pairing/API diff and protocol tests | Checklist for private IPv4 validation, token lifetime/single use, secret hashing, authentication, and revocation | No automatic weakening of a fail-closed rule |
| Dependency upgrade | Lockfiles, upstream release notes/advisories, build/test output | Focused upgrade PR with compatibility notes and rollback path | Maintainer approves dependency and release |
| Dual-platform release QA | Windows build metadata, Android Gradle output, artifact manifests | Release checklist with version/signing/artifact/hash evidence and explicit hardware gaps | Signing, tagging, and publishing stay manual |

## Guardrails

- Least-privilege, read-only access by default; write access is scoped to a branch or draft artifact.
- No clipboard database, imported backup, pairing URL/token, device secret, signing material, private IP address, or user telemetry is sent to a model.
- Generated review text is treated as a draft and cannot approve, merge, tag, sign, or publish.
- Findings must cite repository files or CI output and label assumptions or missing runtime/device evidence.
- Prompt and model changes are evaluated against a small checked-in set of security and release scenarios before use.

## Success measures

- percentage of automation findings with a valid file/line or CI citation;
- false-positive and maintainer-dismissal rate by workflow;
- dependency PRs that pass both desktop and Android CI without unrelated changes;
- release checklists with complete artifact/version/hash evidence and explicit unverified hardware steps;
- time from a reported security regression to a reproducible test, without using stars or download counts as a proxy for impact.

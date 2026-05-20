<!--
Sync Impact Report
- Version change: 1.0.0 -> 1.1.0
- Modified principles:
  - 1. Mission produit -> 1. Product Mission
  - 2. Positionnement dans l'ecosysteme -> 2. Ecosystem Positioning
  - 3. Valeur metier prioritaire -> 3. Priority Business Value
  - 4. Principes d'ingenierie -> 4. Engineering Principles
  - 5. Architecture et coherence du code -> 5. Architecture and Code Coherence
  - 6. Politique de tests -> 6. Testing Policy
  - 7. UX Ionic et qualite mobile -> 7. Ionic UX and Mobile Quality
  - 8. Realtime Firebase -> 8. Firebase Realtime
  - 9. Securite et donnees -> 9. Security and Data
  - 10. Gamification responsable -> 10. Responsible Gamification
  - 11. Performance et fiabilite -> 11. Performance and Reliability
  - 12. Gouvernance des choix techniques -> 12. Technical Decision Governance
  - 13. Documentation vivante -> 13. Living Documentation
- Added sections:
  - Language Governance
- Removed sections:
  - None
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md
  - ✅ .specify/templates/spec-template.md
  - ✅ .specify/templates/tasks-template.md
  - ⚠ pending (not found in repository): .specify/templates/commands/*.md
- Follow-up TODOs:
  - None
-->

# Datadriven Mobile Companion Constitution

## Core Principles

### 1. Product Mission
The mobile companion app serves employees and enables simple, gamified field input
to support manager decision-making in Datadriven SaaS. Every mobile feature MUST
clearly contribute to this mission.
Rationale: product value depends on a reliable field-to-management signal loop.

### 2. Ecosystem Positioning
The web SaaS MUST remain the primary manager tool, and the Angular/Ionic mobile app
MUST remain the primary employee tool. Mobile evolution MUST strengthen this
complementarity and MUST NOT duplicate manager workflows without clear justification.
Rationale: role clarity prevents product sprawl and ownership confusion.

### 3. Priority Business Value
Each mobile feature MUST improve at least one business lever: response frequency,
signal quality, engagement, or usage continuity. Features without measurable impact
on at least one lever MUST NOT be prioritized.
Rationale: explicit value targeting ensures delivery ROI.

### 4. Engineering Principles
Code MUST remain simple, readable, and maintainable. Technical decisions MUST favor
useful simplicity over premature complexity. Abstractions MUST be introduced only
when they materially reduce duplication or risk.
Rationale: sustainable delivery speed requires maintainable systems.

### 5. Architecture and Code Coherence
Architecture MUST stay explicit by functional domain. UI, business logic, data
access, and utility responsibilities MUST be clearly separated. Code MUST remain
understandable to new contributors without undocumented assumptions.
Rationale: explicit boundaries reduce onboarding friction and hidden regressions.

### 6. Testing Policy
All critical functionality MUST be covered by automated tests. `tests/` structure
MUST mirror impacted `src/` paths to preserve traceability and structured coverage.
No critical regression MUST be merged without an associated non-regression test.
Rationale: reliability requires targeted, traceable coverage.

### 7. Ionic UX and Mobile Quality
The app MUST follow Ionic UX conventions for navigation, feedback, loading states,
and touch interactions. Screens MUST remain fluid and accessible on real devices,
including unstable networks and low-end hardware. Quiz/input flows MUST minimize
friction and interaction count.
Rationale: employee adoption depends on robust mobile UX.

### 8. Firebase Realtime
Firebase Realtime best practices MUST be applied: targeted listeners, limited
payloads, explicit subscription lifecycle management, and resilient reconnect logic.
Writes MUST be safe, consistent, and idempotent where needed. Realtime logic MUST
NOT create avoidable network or battery overhead.
Rationale: perceived quality and reliability depend on realtime discipline.

### 9. Security and Data
Least privilege MUST be enforced throughout the system. Personal data MUST NOT be
collected or stored without a clear legitimate basis and consent when required.
Access rules MUST enforce strict data isolation by tenant and by role.
Rationale: trust and compliance are non-negotiable.

### 10. Responsible Gamification
Gamification MUST encourage participation without manipulation or unfair penalties.
Scoring, badges, progression, and rewards MUST remain transparent, understandable,
and aligned with contribution quality.
Rationale: long-term engagement requires user trust.

### 11. Performance and Reliability
Mobile performance MUST be treated as a product quality criterion, not optional
optimization. Loading, transitions, and synchronization MUST remain acceptable in
realistic network conditions. Errors MUST provide actionable messages and recovery
paths.
Rationale: usage continuity depends on reliable interaction quality.

### 12. Technical Decision Governance
When trade-offs are required, priority order MUST be:
1. Data security and privacy.
2. Business reliability and consistency.
3. Maintenance simplicity.
4. Employee experience quality.
5. Delivery speed.
Rationale: explicit priorities ensure consistent decisions under pressure.

### 13. Living Documentation
Architecture decisions and business contracts MUST be documented and kept current.
Any major mobile evolution MUST include documented impacts on tests, security, UX,
and realtime synchronization.
Rationale: documentation is an operational asset, not ceremony.

## Product & Delivery Requirements

Every feature proposal MUST include:
- A value hypothesis linked to at least one business lever from Principle 3.
- An explicit data-security impact assessment (Principle 9).
- A mobile robustness plan (Principle 7) and realtime plan (Principle 8).
- A testing strategy covering critical risks (Principle 6).
- Performance and error-recovery controls (Principle 11).

## Delivery & Review Workflow

Every plan, specification, and task set MUST pass a Constitution Check explicitly
verifying Principles 3, 6, 7, 8, 9, and 11. Reviews MUST block non-compliant
delivery until correction or documented exception. Any exception MUST include a
justification, accepted risk statement, and a revalidation date.

## Language Governance

User prompts MAY be written in French, but project governance and delivery artifacts
MUST be written in English. This requirement applies to constitution, specification,
planning, tasks, and related project documentation generated by SpecKit workflows.

## Governance

This constitution overrides local practices that conflict with it. Amendments MUST
be proposed through a documented PR with explicit impacts on templates, tests,
security, and architecture. Versioning policy follows SemVer:
- MAJOR: incompatible principle removal or redefinition.
- MINOR: new principle/section or materially expanded normative guidance.
- PATCH: wording clarifications without normative change.

Compliance reviews MUST be performed at minimum during `speckit.plan`,
`speckit.tasks`, and before merging major application changes.

**Version**: 1.1.0 | **Ratified**: 2026-05-20 | **Last Amended**: 2026-05-20

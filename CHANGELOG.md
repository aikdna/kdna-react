# Changelog

## 0.2.1 (2026-07-16)

- Replace the retired trace shape with the sole current JudgmentTrace contract.
- Render delivery, execution, semantic consumption, and conformance as separate
  evidence instead of treating Host completion as proof of model behavior.
- Replace the removed answer-summary helper with result-digest evidence and
  rename the public TypeScript trace type to `JudgmentTrace`.

- Generate the browser validator from the pinned Core schema closure and fail
  closed on hostile nested trace mutations at every public boundary.
- Bind release publication to the full CI gate and exact no-prefix SemVer tag.
- Remove an obsolete direct-file `useTrace` implementation from the package and
  test the actual npm tar so every shipped trace path fails closed.

## 0.2.0 (2026-07-12)

- Add fail-closed parsing and validation for the current JudgmentTrace
  contract; stale or unknown trace shapes are rejected.
- Add `KDNATraceViewer`, trace helpers, and the single/Cluster-aware
  `useTrace` data surface.
- Keep JavaScript and TypeScript trace extraction fields in parity.
- Publish a package-level `index.d.ts` and verify the public type surface in
  CI so TypeScript consumers resolve the same exports as JavaScript consumers.

## 0.1.1 (2026-07-03)

- Normalize `repository.url` metadata for npm.
- Add a lightweight lint script to the package CI path.
- Add `SECURITY.md` to the npm package files.
- Use a CI-portable test glob.
- Add `prepublishOnly` release protection.

## 0.1.0 (2026-07-03)

Initial public release of the KDNA React integration.

- React hooks: `useKDNA`, `useKDNALoadPlan`
- Components: `KDNAAssetInspector`, `KDNAFileDropzone`,
  `KDNALicenseActivationForm`, `KDNALoadPlanGate`,
  `KDNAPasswordUnlockDialog`
- SSR-safe rendering
- `@aikdna/kdna-react` scoped npm package
- Component and hook documentation

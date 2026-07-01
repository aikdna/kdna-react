# Contributing to kdna-react

## Issues

Open an issue at the repository. Include:

- React version
- Browser and version
- Minimal reproduction steps or a CodeSandbox link
- Expected vs actual behavior

If proposing a new component or hook, tag the issue `[RFC]` and
describe the user problem it solves before the API design.

## Pull Requests

1. Fork and branch from `main`.
2. Keep PRs focused — one logical change per PR.
3. All commits must be signed off: `git commit -s`
4. Title format: `area: what changed` (e.g. `KDNAFileDropzone: add accept prop`)
5. Verify before opening:
   - `npm test` passes
   - `npm run build` succeeds
   - New or changed props are reflected in the component's doc file
     under `docs/components/`

## Security Issues

Do **not** report security vulnerabilities through public GitHub issues.
See [SECURITY.md](./SECURITY.md) for the private reporting path.

## Developer Certificate of Origin (DCO)

All commits must include a `Signed-off-by:` line.
Use `git commit -s` to add it automatically. No CLA is required.

## Component Guidelines

- Components are thin UI wrappers over `@aikdna/kdna-web-client` state
  and server endpoints. Business logic belongs upstream.
- Props should be typed with JSDoc or TypeScript declarations.
- Every component must have at least one snapshot or interaction test.
- Default styles use CSS custom properties so the host application can
  override them without !important hacks.

## Security Constraints (Non-Negotiable)

- Components **must not** receive passwords or license keys as props
  and pass them through to other components. Each sensitive value must
  travel directly from the user input element to the server endpoint
  via a POST body — never stored in React state longer than needed for
  the single in-flight request.
- Components **must not** render decrypted payload content directly.
  Display only metadata fields and load-plan state.

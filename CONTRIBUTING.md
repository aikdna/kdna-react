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
   - `npm run ci` passes
   - `KDNA_REACT_ASSET=/path/to/accepted.kdna npm run test:web-stack-integration`
     passes when the network/load or activation boundary changes
   - New or changed props are reflected in the component's doc file
     under `docs/components/`

## Security Issues

Do **not** report security vulnerabilities through public GitHub issues.
See [SECURITY.md](./SECURITY.md) for the private reporting path.

## Developer Certificate of Origin (DCO)

All commits must include a `Signed-off-by:` line.
Use `git commit -s` to add it automatically. No CLA is required.

## Component Guidelines

- Components and hooks reuse exact `@aikdna/kdna-web-client@0.2.2` for the
  browser network/load boundary. Protocol and crypto business logic belongs
  upstream.
- Props should be typed with JSDoc or TypeScript declarations.
- Every component must have at least one snapshot or interaction test.
- Components are intentionally unstyled. Keep visual styling in
  examples or host applications unless a future design-system contract is
  introduced and documented.

## Security Constraints (Non-Negotiable)

- Components **must not** receive passwords or license keys as props
  and pass them through to other components. Each sensitive value must
  travel directly from the user input element to the server endpoint
  via a POST body — never stored in React state longer than needed for
  the single in-flight request.
- Render loaded context deliberately through safe React nodes or an explicit
  serializer such as `JSON.stringify(content, null, 2)`. Never pass an object
  directly as a React child, and never log protected content or credentials.
- Treat upstream errors as private. Do not attach response bodies, provider
  details, storage paths, or submitted secrets to component errors or UI.

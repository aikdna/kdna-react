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
4. Title format: `area: what changed` (e.g. `KDNAReadView: clarify pending state`)
5. Verify before opening:
   - `npm run ci` passes
   - The current default suite uses in-process Request/Response fixtures. Any
     separate real HTTP or browser claim needs its own actual verification.
     The historical `test:http` entry requires `KDNA_TEST_ORIGIN` and its
     matching Host fixture; it is not part of the default current suite.
   - New or changed props are reflected in `docs/consumption-contract.md`
     and the public TypeScript declarations.

## Security Issues

Do **not** report security vulnerabilities through public GitHub issues.
See [SECURITY.md](./SECURITY.md) for the private reporting path.

## Developer Certificate of Origin (DCO)

All commits must include a `Signed-off-by:` line.
Use `git commit -s` to add it automatically. No CLA is required.

## Component Guidelines

- Components and hooks use the exact public Web Client dependency in
  `package.json` and `public-contract-binding.json` for selection and Read.
  Protocol and crypto business logic belongs upstream.
- Props should be typed with JSDoc or TypeScript declarations.
- Every component must have at least one snapshot or interaction test.
- Components are intentionally unstyled. Keep visual styling in
  examples or host applications unless a future design-system contract is
  introduced and documented.

## Security Constraints (Non-Negotiable)

- Components **must not** receive passwords or license keys as props.
  This package provides no credential, activation or license endpoint.
- Render loaded context deliberately through safe React nodes or an explicit
  serializer such as `JSON.stringify(content, null, 2)`. Never pass an object
  directly as a React child, and never log protected content or credentials.
- Display only the public selection diagnostics and admitted remote result
  passed by Web Client. Do not attach private provider details, storage paths,
  unadmitted response bodies or submitted secrets to component errors or UI.

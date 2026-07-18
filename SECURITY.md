# Security Policy

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Instead, use one of these private channels:

- **GitHub Private Vulnerability Reporting**: Go to the [Security Advisories](https://github.com/aikdna/kdna-react/security/advisories/new) page
- **Email**: security@aikdna.com

We aim to respond within 72 hours and provide a timeline for resolution within 1 week.
Please do not disclose the vulnerability publicly until we have had a chance to address it.

## Supported Versions

`kdna-react` is an experimental React integration support surface. Security
support tracks the latest package release and its exact tested KDNA runtime
coordinates.

| Component | Supported Versions |
|-----------|-------------------|
| KDNA Core schema authority | 0.20.0 (`1e77e3e0d486c330fe9f9262b514ef24c859d469`) |
| KDNA Web Client runtime | 0.2.2 |
| KDNA Web Server integration | 0.3.0 |
| KDNA Activation integration | 0.2.0 |
| kdna-react | 0.3.0 |

Older pre-release versions may receive critical security patches on a
case-by-case basis.

## Security Model

`kdna-react` delegates HTTP response limits, safe error projection, LoadPlan
handling, and Runtime Capsule validation to exact Web Client 0.2.2. It must not
define protocol validity, access modes, or cryptographic policy; those
contracts come from KDNA Core and compatible server behavior.

Password and license inputs are briefly present in browser input elements and
React state because the user must submit them. This package clears them before
the request completes and again when the request settles, before success
callbacks run, and does not write them to browser storage. Applications must
not log request bodies, callback values, or
errors. Web Client errors never attach upstream response bodies (`response` is
always `null`), and React activation errors follow the same rule.

The browser does not decrypt `.kdna` payloads. A successful load is accepted
only after Web Client validates the complete Runtime Capsule schema closure;
authoritative integrity, authorization, decryption, and projection remain
server-side KDNA Core responsibilities.

For the KDNA Protocol security architecture, see
[GOVERNANCE.md](https://github.com/aikdna/kdna/blob/main/docs/GOVERNANCE.md)
in the main protocol repository.

# Security Policy

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Instead, use one of these private channels:

- **GitHub Private Vulnerability Reporting**: Go to the [Security Advisories](https://github.com/aikdna/kdna-react/security/advisories/new) page
- **Email**: security@aikdna.com

We aim to respond within 72 hours and provide a timeline for resolution within 1 week.
Please do not disclose the vulnerability publicly until we have had a chance to address it.

## Security boundary

Only the public Web Client bound in public-contract-binding.json supplies selection admission and transport admission. React accepts caller-supplied ReadTransportContext and displays the public SelectionResult, ClientResult and RemoteReadViewModel. It does not validate raw file structures, generate authority, authorize actions, create handles, or implement a remote Host. Remote identity, authorization, revocation, network replay and delivery remain the public ViewModel's stated proof limits. Lifecycle phases and selection diagnostic text do not establish content absence or permission.

All disclosed text is rendered through React text nodes. No HTML injection, HTML parser, markdown renderer, URL activation, script evaluation or raw DOM insertion is used. Limits constrain rendered list length and characters; undisplayed disclosed items and truncated text are explicitly labeled. Applications must retain suitable CSP and use their own trusted UI styles. Native file input labeling, keyboard behavior, focus outline and a polite atomic status region are preserved.

Replacement, cancel, release, unmount and disposal invalidate pending publication and abort network work through Web Client. Client byte, timeout and concurrency limits remain authoritative. The bounded multipart materialization in Web Client may increase transient memory; fixed RSS/GC or load performance is not claimed. An ignored AbortSignal in a supplied fetch cannot publish stale React state; the client controls the lifetime of its underlying slot.

Legacy APIs and deep paths are closed. Protected vendor and CI history in the repository are neither imported nor packaged. No runtime validator, private Core import, Node/server module or development fallback is present in the React runtime. Report non-security issues through the repository's configured issue tracker without including private asset bytes or credentials. Use the private channels above for vulnerabilities.

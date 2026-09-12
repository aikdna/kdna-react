# Changelog

## Current component semantics candidate

Bind the current public Web Client graph. Preserve the exact public selection result, including Core rejection states and component diagnostics, in the hook. Add optional state-aware result presentation so an in-progress or cancelled operation is described without inferring empty content or new permission. The existing result-only view and explicit read/cancel/release/dispose lifecycle remain supported.

Source checks use the locked React 18.3.1 and TypeScript 5.9.3 graph. The current default suite uses in-process Request/Response objects and makes no new real HTTP or browser claim. The older observations below retain their historical scope.

## 0.5.0 candidate

Replace the prior integration with four public remote Read consumer exports: useKDNARead, KDNAFileInput, KDNAReadStatus and KDNAReadView. The previous exports, types and deep paths are removed without compatibility aliases. Lifecycle ownership now follows committed React effects, with selection replacement, concurrent read display ordering, cancellation, release and disposal. Public Web Client 0.4.1 supplies technical admission and native upload cancellation.

The source is directly distributable JavaScript with identical CJS/ESM function identities and TypeScript declarations. Verification is limited to the exact fixed dependency tarballs, React 18.3.1, Node 26.5.1, Chrome 152 and Playwright WebKit 26.5 used in the implementation evidence. Cross-request positive expansion and public release remain unproven/unauthorized.

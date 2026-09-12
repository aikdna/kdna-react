# Current component fixtures

These two synthetic byte fixtures come from the accepted public Core/Read component verification, retained through the Web Client verification. They are test data, not official editorial assets or human adoption evidence. The implementation tests consume them through public APIs.

- independent-mechanisms.kdna: SHA-256 `94ff30f5cab81427f2bb22f5dabb5814bb6f139b0d2263d342636690227930d7`.
- taxonomy-cycle.kdna: SHA-256 `a66c09e61274bdb77ea8a6baabb572b46f475569a4894e8794737db5c4c07101`.

The in-process Request/Response adapter supplies an explicit synthetic Host allow/deny decision. Native Node Fetch uses a fixed scripted dispatcher to construct the Response, its URL and response headers. It opens no socket and proves no HTTP server behavior or remote identity. No global or Response prototype is changed.

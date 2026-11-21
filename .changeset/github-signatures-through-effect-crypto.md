---
"@shivaedev/github": minor
"@shivaedev/webhooks": minor
---

### Breaking

- `@shivaedev/github`: `verifyWebhook` checks the `X-Hub-Signature-256` tag with `Mac` from `effect/crypto` and now requires `Mac` in its Effect's type. Inside the application host nothing changes, because the host provides `NodeCrypto.layer`. Code that verifies outside a host, such as a script or a test without a story kit, provides `NodeCrypto.layerMac` from `@effect/platform-node/NodeCrypto`. An empty webhook secret now refuses every delivery with `GitHubWebhookSignatureError`.
- `@shivaedev/github`: `githubApp` signs App JWTs with `Signature` from `effect/crypto`, so its Layer now requires `Signature`. Inside the application host nothing changes; elsewhere provide `NodeCrypto.layerSignature` from `@effect/platform-node/NodeCrypto`. The private key stays the PKCS#1 PEM GitHub issues, or the same key as PKCS#8.
- `@shivaedev/webhooks`: `WebhookStrategy` takes the services its `verify` needs as a type parameter, `WebhookStrategy<R = never>`, and `WebhookSource<R, E>` holds a `WebhookStrategy<R>`. `githubStrategy` is a `WebhookStrategy<Mac>`, so a `githubSource` and its `webhookRoute` Layer require `Mac`, which the application host provides. A custom strategy that needs no service compiles unchanged.

# Cancellation

The client helpers retain native Effect and atom lifetimes. The
[hook tests](../../packages/effect-react/test/hooks.test.ts) drive `useAction`
through React: a newer dispatch interrupts the earlier action, and an older
completion cannot replace the latest rendered result.

For Node request lifetimes,
[`nodeSubscriptionSignal`](../../packages/platform/src/node-http.ts) combines
request and caller abort signals. Its
[tests](../../packages/platform/test/node-http.test.ts) cover disconnects,
completed requests and listener disposal.

An HTTP host must forward the disconnect to the Web Request's AbortSignal for
native RPC cancellation to reach the server. Verify that bridge in the deployed
host and proxy. The library tests do not establish end-to-end cancellation for
an arbitrary deployment, React unmount or mobile backgrounding.

Cancellation before a write differs from cancellation after commit. A disconnected
client may miss a successful response. Reconcile with a read and use an application
idempotency policy for retryable commands with external effects. Detached work,
uninterruptible sections and external systems can outlive the requesting fiber.

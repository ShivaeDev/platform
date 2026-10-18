# Cancellation

The client helpers retain native Effect and atom lifetimes. In `useAction`, a
newer dispatch interrupts the earlier action, and an older completion cannot
replace the latest rendered result.

For Node request lifetimes,
[`nodeSubscriptionSignal`](../../packages/platform/src/server/node-http/subscriptionSignal.ts) combines
request and caller abort signals; call its `dispose` to remove its Node listeners.

An HTTP host must forward the disconnect to the Web Request's AbortSignal for
native RPC cancellation to reach the server. Verify that bridge in the deployed
host and proxy.

Cancellation before a write differs from cancellation after commit. A disconnected
client may miss a successful response. Reconcile with a read and use an application
idempotency policy for retryable commands with external effects. Detached work,
uninterruptible sections and external systems can outlive the requesting fiber.

# Cancellation

The client helpers retain native Effect and atom lifetimes. In `useAction`, a newer dispatch interrupts the earlier action, and an older completion cannot replace the latest rendered result.

For Node request lifetimes, [`nodeSubscriptionSignal`](../../packages/platform/src/server/node-http/subscriptionSignal.ts) combines request and caller abort signals; call its `dispose` to remove its Node listeners.

`appHost` forwards an HTTP client disconnect to native RPC cancellation. Aborting a client's `fetch` interrupts both an RPC handler and a live `AppChanges` subscription: the handler's finalizer runs, its open sql transaction rolls back, and its connection returns to the pool. The stream's finalizer runs and releases its Reactivity registrations, so later commits no longer reach it. The [app-host cancellation stories](../../packages/platform/src/server/rpc-server/clientAbort.spec.ts) prove these lifetimes through real HTTP and PostgreSQL.

Whether a hosting proxy forwards the client's disconnect to the app remains the deployment's to verify.

Cancellation before a write differs from cancellation after commit. A disconnected client may miss a successful response. Reconcile with a read and use an application idempotency policy for retryable commands with external effects. Detached work, uninterruptible sections and external systems can outlive the requesting fiber.

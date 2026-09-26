# HTTP cancellation

The order example uses native Effect RPC and FetchHttpClient. Cancelling the client
fiber can abort its HTTP request, which interrupts the server handler when the
HTTP host forwards the disconnect to the Web Request's AbortSignal. Scoped
resources then release through ordinary Effect finalizers.

## What is proved

[`order-cancellation.test.ts`](../../packages/effect-react/test/order-cancellation.test.ts)
starts the real loopback server and calls `SaveOrder` through `RpcClient.make`,
HTTP and JSON serialization. The server acquires scoped work at the existing
`beforeSave` boundary and signals a Deferred before waiting on another Deferred.
The test interrupts the client fiber, waits for the server's finalizer, and
asserts its exit contains interruption. It then opens the gate and independently
reads `GetOrder`: the original order remains stored. No sleep establishes ordering;
the timeout only bounds a broken implementation.

The test host previously constructed a fresh Web Request without its disconnect
signal. [`http-test.ts`](../../packages/effect-react/test/order-example/http-test.ts)
now forwards an aborted incoming request or a prematurely closed outgoing
response to an AbortController, passes its signal to the request, and removes the
listeners when handling finishes. An ordinary completed response does not abort.
Removing that signal from the bridge causes this regression test to time out
waiting for the server finalizer.

## Limits and application policy

- This proves cancellation **before the write**, not undoing a committed save.
  A client disconnect after commit can still leave a successful write whose
  response never reaches the client. Reconcile through a read, and design
  idempotency for retryable commands with external consequences.
- The installed HTTP RPC transport ignores non-request protocol messages. Its
  cancellation path relies on aborting HTTP, rather than delivering a separate
  RPC interrupt message to a persistent connection.
- Cancellation reaches the server only when the deployed host/proxy forwards the
  disconnect. The Node bridge is a test adapter; deployment adapters and proxies
  need their own verification. A browser closing a page or a mobile application
  entering the background is not a durable cancellation protocol.
- Scoped Effect work participates in interruption. Detached work, uninterruptible
  sections and external systems may outlive the requesting fiber. Their lifetimes
  require explicit product policy.
- No claim is made here about React unmount automatically cancelling a mutation.
  Atom lifetimes, shared subscribers and retained runtimes determine whether an
  RPC fiber is interrupted. The query/action helpers retain those native rules.

The framework needs no additional cancellation API for this boundary. Preserve
native Effect scopes and the host's AbortSignal; define save/retry behavior at the
application boundary where it is meaningful.

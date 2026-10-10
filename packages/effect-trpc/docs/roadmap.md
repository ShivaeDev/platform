# Roadmap

This file owns `effect-trpc` implementation status and local next work. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns composed application fixtures, adoption and deployment validation. A library test is not application adoption evidence.

## Built

- Generator queries and mutations over an application runtime and request services, including context supplied by tRPC middleware and request-Layer extensions that consume base services. `src/adapter.test.ts` covers runtime execution; `src/procedure.typecheck.test.ts` rejects missing services.
- Effect Schema input and output decoding with encoded/decoded caller and resolver types. Adapter runtime tests and procedure type tests cover the distinction, including subscription output decoding.
- Stream subscriptions with request services, scoped finalizers and interruption when a caller signal aborts. `src/adapter.test.ts` observes values, stream instrumentation and finalization; `src/internal/runtime.test.ts` covers pure interruption's transport error.
- Explicit tRPC errors, application error mapping and redaction of unmapped failures and defects. Adapter/runtime tests cover resolver, request-Layer, mapper and Effect-instrumentation defects; `src/httpRejections.spec.ts` checks opaque serialized failures.
- Tagged declared rejection encoding, taxonomy code mapping, custom code selection and formatter composition. `src/rejection.test.ts` and `src/httpRejections.spec.ts` cover fields, messages, encodings, HTTP statuses and mixed batches.
- Input-validation field paths and the reserved `invalidInput` mark. `src/inputRejections.spec.ts` covers dotted paths, array indexes, whole-input issues and stripping forged marks; `src/rejection.typecheck.test.ts` rejects reserved fields.
- Client rejection reading and schema decoding, including malformed carriers and unknown tags. HTTP rejection tests and rejection type tests cover values, class instances and synchronous decoder requirements.
- Reuse of `effect-contract` operation error schemas with generated and reused rejection classes. `src/contractRejections.spec.ts` also checks opaque failures for an operation without declared rejections.
- An Effect-shaped caller and application-defined test harness built on `effect-test`. `src/testing/vitest.test.ts` covers runtime service overrides, alternate contexts, table cases and harness services; its type tests preserve caller and harness types.

## Next

1. Add direct observations for the declared instrumentation boundary: span naming, stream instrumentation with request services, and the supplied `RequestSignal` value. The source exposes these pieces; existing tests do not establish all of those observations.
2. Add a representative real-host transport cancellation fixture when a consumer selects that transport. Observe query and subscription interruption and resource release; keep proxy/deployment acceptance with the consuming application.
3. Exercise test-harness setup inside the `around` wrapper and Layer acquisition lifetime through this adapter if consumers rely on that composition. The shared runner owns the implementation; adapter tests should observe the composition they promise.

These are draft priorities, subject to the maintainer's investment decision below.

## Questions the maintainer owns

- Should the package receive new adapter features, or focus on compatibility and stronger boundary evidence for tRPC consumers? The draft next work favors evidence for existing behavior. The root package paths establish its purpose but do not set its investment order.
- Which real host and tRPC transport should be the first cancellation fixture? Caller-signal tests and in-process fetch serialization do not decide a deployment transport.
- Should `RequestSignal` become a uniform service for queries and mutations as well as subscriptions? It is currently supplied by the subscription handler; expanding that boundary is an API/behavior decision, not documentation work.

## Evidence boundaries

The HTTP rejection tests call tRPC's fetch handler in process with its actual client and transformer. Subscription cancellation uses `router.createCaller` with an abort signal and observes its iterator and finalizer. Neither is proof of a network server, WebSocket disconnect, reverse proxy, SSR or mobile lifecycle. Broader composed fixtures and deployment acceptance belong to the framework roadmap and the adopting application.

---
"@shivaedev/test-story": minor
---

### Breaking

- Move the Node HTTP, OTLP wire decoding and synchronous failure-reporting bridges into adapters. Replace imports from `@shivaedev/test-story/server/internal/<module>.ts` with `@shivaedev/test-story/server/adapters/<module>.ts` for `callSite`, `engineSnapshot`, `failureReport`, `fakeHttpAnswer`, `fakeHttpReceive`, `fakeHttpSend`, `loopback`, `otlpProtobuf` and `otlpWire`.
- Make `fakeHttpGates(...).make(...)` return an Effect. Callers importing this internal helper must yield the returned Effect to create a hold. The public `fakeHttpService` controls keep their existing Effect interface and defect messages.

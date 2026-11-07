---
"@shivaedev/quality": patch
---

### Fixed

- Accept React component props carrying an already-built connection and AtomRegistry while retaining service-parameter findings on ordinary functions.
- Follow constructed foreign resources through adapter acquisition helpers, keeping injected services visible.
- Treat a Layer's own Scope, allocated maps and Ref-backed handles and closures as owned initializer state.
- Accept application-kit Context merges and Layer acquisition under an explicit restart scope while rejecting ambient context capture.
- Recognise private test-composition packages consumed only by tests, test support and package development scripts.
- Follow variable entry lists through bundler helpers and recognise conventional dependency-cruiser configs as entries.
- Recognise explicit Vitest config and reporter paths and typed foreign adapter plugins as default-export tool contracts.

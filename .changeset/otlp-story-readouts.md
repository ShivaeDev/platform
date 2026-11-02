---
"@shivaedev/test-story": minor
---

### Added

- Read exported secrets, traced SQL queries and reported errors from the fake OTLP receiver in stories.
- Build a scoped tracing layer with the tracer logger included, and flush buffered and in-flight spans to the receiver without stopping tracing.

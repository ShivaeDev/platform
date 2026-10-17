### Fixed

- Run every stage's `after` hook without the story's parent span, including its scoped teardown and finalizers, so hosts booted after deployment can start independent request traces while story verbs keep their story span.

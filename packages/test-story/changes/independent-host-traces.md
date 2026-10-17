### Fixed

- Run engine creation without the story's parent span, so in-process HTTP handlers capture an independent context: requests without trace headers start root traces, and `traceparent` continues the supplied trace. Traits, steps and the story body retain their story span.

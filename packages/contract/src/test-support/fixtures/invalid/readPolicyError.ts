import { Effect, Schema } from "effect";
import { query } from "#operation.ts";

class ServiceUnavailable extends Schema.TaggedError<ServiceUnavailable>()("ServiceUnavailable", {}) {}
query("read", { readPolicy: () => Effect.fail(new ServiceUnavailable()), reads: () => [] });

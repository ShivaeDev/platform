import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { query } from "#operation.ts";

query("read", { readPolicy: () => Effect.fail(new ServiceUnavailable({ message: "Database unavailable" })), reads: () => [] });

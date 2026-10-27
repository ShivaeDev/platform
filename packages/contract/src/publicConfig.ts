import { Effect, type Schema } from "effect";
import { contract } from "#contract.ts";
import { query } from "#operation.ts";

export function publicConfig<T, E>(schema: Schema.Codec<T, E>) {
	return contract("platform.publicConfig", {
		queries: [query("get", { readPolicy: () => Effect.succeed(true), reads: () => [], success: schema })],
	});
}

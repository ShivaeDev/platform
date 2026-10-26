import type { Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";

export function publicConfig<T, E>(schema: Schema.Codec<T, E>) {
	return contract("platform.publicConfig", {
		queries: [query("get", { reads: () => [], success: schema })],
	});
}

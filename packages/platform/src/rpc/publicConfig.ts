import type { Schema } from "effect";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { query } from "@shivaedev/effect-contract/operation.ts";

export function publicConfig<T, E>(schema: Schema.Codec<T, E>) {
	return contract("platform.publicConfig", {
		queries: [query("get", { reads: () => [], success: schema })],
	});
}

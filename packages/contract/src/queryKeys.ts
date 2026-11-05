import { Effect, Option } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";
import type { QueryServices } from "#contract.ts";
import type { QueryShape } from "#operation.ts";
import { queryReadKeys } from "#queryReadKeys.ts";
import { checkQuery, type Viewer } from "#readPolicy.ts";
import type { MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";
import { resolveQueries } from "#resolveQueries.ts";
import type { QueryReference } from "#serverMetadata.ts";

export function queryKeys<const TQueries extends readonly QueryShape[]>(
	queries: TQueries,
	requested: readonly QueryReference[],
	viewer?: Option.Option<Viewer>,
): Effect.Effect<readonly Key[], TQueries[number]["error"]["Type"] | MissingReadPolicy | QueryReadDenied, QueryServices<TQueries[number]>>;
export function queryKeys(queries: readonly QueryShape[], requested: readonly QueryReference[], viewer: Option.Option<Viewer> = Option.none()) {
	return Effect.fnUntraced(function* () {
		const resolved = yield* resolveQueries(queries, requested);
		yield* Effect.forEach(resolved, ({ query, payload }) => checkQuery(query, payload, viewer));
		const scopes = yield* Effect.forEach(resolved, ({ query, payload }) => queryReadKeys(query, payload, viewer));
		return scopes.flat();
	})();
}

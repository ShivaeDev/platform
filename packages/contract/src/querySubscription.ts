import { Context, Effect, type Option } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";
import { checkQuery, type Viewer } from "#readPolicy.ts";
import type { QueryRequest } from "#serverMetadata.ts";

export interface QuerySubscription {
	readonly authorized: Effect.Effect<boolean>;
	readonly keys: readonly Key[];
	readonly scopes: readonly (readonly Key[])[];
}

export const querySubscription = Effect.fnUntraced(function* (queries: readonly QueryRequest[], viewer: Option.Option<Viewer>) {
	yield* Effect.forEach(queries, ({ query, payload }) => checkQuery(query, payload, viewer));
	const context = Context.makeUnsafe<unknown>((yield* Effect.context<never>()).mapUnsafe);
	const scopes = queries.map(({ query, payload }) => query.reads(payload, viewer));
	const authorized = Effect.map(
		Effect.forEach(queries, ({ query, payload }) => Effect.provideContext(query.readPolicy?.(payload, viewer) ?? Effect.succeed(false), context)),
		(permissions) => permissions.every(Boolean),
	);
	return { authorized, keys: scopes.flat(), scopes } satisfies QuerySubscription;
});

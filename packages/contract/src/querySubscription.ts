import { Context, Effect, type Option } from "effect";
import { Rpc } from "effect/rpc";
import type { Key } from "@shivaedev/changes/keys.ts";
import { policyContext } from "#internal/policyContext.ts";
import { queryReadKeys } from "#internal/queryReadKeys.ts";
import { checkQuery, type PolicyChannels, type Viewer } from "#readPolicy.ts";
import type { MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";
import { ChangesQueries, type QueryReference, type QueryRequest } from "#serverMetadata.ts";

export type QueryRerun<E = unknown, R = never> = (request: QueryRequest) => Effect.Effect<unknown, E, R>;

export interface QuerySubscription<E = never, R = never> {
	readonly authorized: Effect.Effect<boolean, E, R>;
	readonly keys: readonly Key[];
	readonly queries?: readonly QueryRequest[];
	readonly readScopes?: Effect.Effect<readonly (readonly Key[])[], E, R>;
	readonly refresh?: Effect.Effect<Context.Context<never>, E, R>;
	readonly scopes: readonly (readonly Key[])[];
}

export function querySubscription<TRpc extends Rpc.Any>(
	rpc: TRpc,
	references: readonly QueryReference[],
	viewer: Option.Option<Viewer>,
): Effect.Effect<
	QuerySubscription<PolicyChannels<TRpc>["error"], PolicyChannels<TRpc>["services"]>,
	PolicyChannels<TRpc>["error"] | MissingReadPolicy | QueryReadDenied,
	PolicyChannels<TRpc>["services"]
>;
export function querySubscription(rpc: Rpc.Any, references: readonly QueryReference[], viewer: Option.Option<Viewer>) {
	return Effect.fnUntraced(function* () {
		const queries = yield* Context.getUnsafe(rpc.annotations, ChangesQueries).resolve(references);
		const prefix = rpc._tag.slice(0, -"$changes".length);
		const policies = yield* Effect.forEach(
			queries,
			Effect.fnUntraced(function* ({ query, payload }) {
				const context = yield* policyContext(Rpc.make(`${prefix}${query.name}`));
				return {
					check: Effect.provideContext(checkQuery(query, payload, viewer), context),
					keys: Effect.gen(function* () {
						const current = yield* policyContext(Rpc.make(`${prefix}${query.name}`));
						return yield* queryReadKeys(query, payload, viewer).pipe(Effect.provideContext(current));
					}),
					permitted: Effect.gen(function* () {
						const current = yield* policyContext(Rpc.make(`${prefix}${query.name}`));
						return yield* Effect.suspend(() => query.readPolicy?.(payload, viewer) ?? Effect.succeed(false)).pipe(Effect.provideContext(current));
					}),
				};
			}),
		);
		yield* Effect.forEach(policies, ({ check }) => check);
		const readScopes = Effect.forEach(policies, ({ keys }) => keys);
		const scopes = yield* readScopes;
		const authorized = Effect.map(
			Effect.forEach(policies, ({ permitted }) => permitted),
			(permissions) => permissions.every(Boolean),
		);
		return { authorized, keys: scopes.flat(), queries, readScopes, scopes } satisfies QuerySubscription<unknown, unknown>;
	})();
}

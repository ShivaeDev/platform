import { Context, type Duration, Effect, Option } from "effect";
import type { Rpc } from "effect/rpc";
import type { Key } from "./keys.ts";
import { QueryReads } from "./serverMetadata.ts";

export type ReadKeyPolicy<TViewer, E = never, R = never> = (key: Key, viewer: Option.Option<TViewer>) => Effect.Effect<boolean, E, R>;

export type ModuleReadPolicies<TViewer, E = never, R = never> = Readonly<Record<string, ReadKeyPolicy<TViewer, E, R>>>;

export function mergeReadPolicies<TViewer, E, R>(...modules: readonly ModuleReadPolicies<TViewer, E, R>[]): ReadKeyPolicy<TViewer, E, R> {
	return (key, viewer) => {
		const module = modules.find((policies) => Object.hasOwn(policies, key.collection));
		const policy = module?.[key.collection];
		return policy === undefined ? Effect.succeed(false) : policy(key, viewer);
	};
}

export const ReadPolicy = Context.Reference<(key: Key) => Effect.Effect<boolean, unknown>>("@shivaedev/contract/ReadPolicy", {
	defaultValue: () => () => Effect.succeed(true),
});

export const ReadPolicyMemoWindow = Context.Reference<Duration.Input>("@shivaedev/contract/ReadPolicyMemoWindow", {
	defaultValue: () => "1 second",
});

export const authorizeReads = Effect.fnUntraced(function* <A, E, R, TViewer, TPolicyServices, TDenied, TPolicyError>(
	effect: Effect.Effect<A, E, R>,
	request: { readonly rpc: Rpc.AnyWithProps; readonly payload: unknown },
	policy: ReadKeyPolicy<TViewer, TPolicyError, TPolicyServices>,
	viewer: Option.Option<TViewer>,
	denied: Effect.Effect<never, TDenied>,
) {
	const context = yield* Effect.context<TPolicyServices>();
	function canRead(key: Key) {
		return Effect.provideContext(policy(key, viewer), context);
	}
	const reads = Context.getOption(request.rpc.annotations, QueryReads);
	if (Option.isSome(reads)) {
		const allowed = yield* Effect.forEach(reads.value(request.payload), canRead, { concurrency: "unbounded" });
		if (allowed.includes(false)) {
			return yield* denied;
		}
	}
	return yield* Effect.provideService(effect, ReadPolicy, canRead);
});

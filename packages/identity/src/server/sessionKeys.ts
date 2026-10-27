import { Context, Effect, Option } from "effect";
import type { Rpc } from "effect/rpc";
import type { KeyContext } from "@shivaedev/changes/keys.ts";
import { querySubscription } from "@shivaedev/contract/querySubscription.ts";
import { CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import { ChangesQueries, KeyScope, type QueryReference } from "@shivaedev/contract/serverMetadata.ts";
import { Identity } from "#identity.ts";

export function sessionKeyContext(rpc: Pick<Rpc.AnyWithProps, "annotations">): Effect.Effect<KeyContext | undefined> {
	if (Option.isNone(Context.getOption(rpc.annotations, KeyScope))) {
		return Effect.succeed(undefined);
	}
	return Effect.gen(function* () {
		const identity = yield* Effect.serviceOption(Identity);
		if (Option.isNone(identity)) {
			return yield* Effect.die(new Error("Session-scoped contract keys require request-local Identity"));
		}
		return { scope: identity.value.id };
	});
}

export const resolveChanges = Effect.fnUntraced(function* (rpc: Pick<Rpc.AnyWithProps, "annotations">, references: readonly QueryReference[]) {
	const identity = yield* Effect.serviceOption(Identity);
	const current = yield* CurrentViewer;
	const viewer = Option.orElse(identity, () => current);
	const queries = yield* Context.getUnsafe(rpc.annotations, ChangesQueries).resolve(references);
	const subscription = yield* querySubscription(queries, viewer);
	return { context: yield* sessionKeyContext(rpc), subscription };
});

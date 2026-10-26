import { Context, Effect, Option } from "effect";
import type { Rpc } from "effect/rpc";
import type { KeyContext } from "@shivaedev/contract/keys.ts";
import { ChangesReads, KeyScope, type QueryReference } from "@shivaedev/contract/serverMetadata.ts";
import { Identity } from "#rpc/identity.ts";

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

export function resolveChanges(rpc: Pick<Rpc.AnyWithProps, "annotations">, references: readonly QueryReference[]) {
	return Effect.map(sessionKeyContext(rpc), (context) => ({
		context,
		keys: Context.getUnsafe(rpc.annotations, ChangesReads)(references),
	}));
}

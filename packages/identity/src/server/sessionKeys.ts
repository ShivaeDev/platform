import { Context, Effect, Option } from "effect";
import type { Rpc } from "effect/rpc";
import type { KeyContext } from "@shivaedev/changes/keys.ts";
import { type QuerySubscription, querySubscription } from "@shivaedev/contract/querySubscription.ts";
import { CurrentViewer, type PolicyChannels } from "@shivaedev/contract/readPolicy.ts";
import type { MissingReadPolicy, QueryReadDenied } from "@shivaedev/contract/readPolicyErrors.ts";
import { KeyScope, type QueryReference } from "@shivaedev/contract/serverMetadata.ts";
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

export function resolveChanges<TRpc extends Rpc.Any>(
	rpc: TRpc,
	references: readonly QueryReference[],
): Effect.Effect<
	{
		readonly context: KeyContext | undefined;
		readonly subscription: QuerySubscription<PolicyChannels<TRpc>["error"], PolicyChannels<TRpc>["services"]>;
	},
	PolicyChannels<TRpc>["error"] | MissingReadPolicy | QueryReadDenied,
	PolicyChannels<TRpc>["services"]
>;
export function resolveChanges(rpc: Rpc.Any, references: readonly QueryReference[]) {
	return Effect.fnUntraced(function* () {
		const identity = yield* Effect.serviceOption(Identity);
		const current = yield* CurrentViewer;
		const viewer = Option.orElse(identity, () => current);
		const subscription = yield* querySubscription(rpc, references, viewer);
		return { context: yield* sessionKeyContext(rpc), subscription };
	})();
}

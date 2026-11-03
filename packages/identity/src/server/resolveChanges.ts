import { Effect, Option } from "effect";
import type { Rpc } from "effect/rpc";
import { type QuerySubscription, querySubscription } from "@shivaedev/contract/querySubscription.ts";
import { CurrentViewer, type PolicyChannels } from "@shivaedev/contract/readPolicy.ts";
import type { MissingReadPolicy, QueryReadDenied } from "@shivaedev/contract/readPolicyErrors.ts";
import type { QueryReference } from "@shivaedev/contract/serverMetadata.ts";
import { Identity } from "#identity.ts";

export function resolveChanges<TRpc extends Rpc.Any>(
	rpc: TRpc,
	references: readonly QueryReference[],
): Effect.Effect<
	QuerySubscription<PolicyChannels<TRpc>["error"], PolicyChannels<TRpc>["services"]>,
	PolicyChannels<TRpc>["error"] | MissingReadPolicy | QueryReadDenied,
	PolicyChannels<TRpc>["services"]
>;
export function resolveChanges(rpc: Rpc.Any, references: readonly QueryReference[]) {
	return Effect.fnUntraced(function* () {
		const identity = yield* Effect.serviceOption(Identity);
		const current = yield* CurrentViewer;
		const viewer = Option.orElse(identity, () => current);
		return yield* querySubscription(rpc, references, viewer);
	})();
}

import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Cause, Effect, Exit, Layer } from "effect";

const services = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);

// Runs a generator effect for a tool that awaits a Promise, failing it with the effect's own error.
export async function runNode<A, E>(effect: Effect.Effect<A, E, Layer.Success<typeof services>>): Promise<A> {
	const exit = await Effect.runPromiseExit(Effect.provide(effect, services));
	if (Exit.isSuccess(exit)) {
		return exit.value;
	}
	const failure = Cause.squash(exit.cause);
	throw failure instanceof Error ? failure : new Error(String(failure), { cause: failure });
}

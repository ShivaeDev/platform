import { Effect, Predicate } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { Settings } from "./contract.ts";
import { makeClient } from "./makeClient.ts";
import { withReact } from "./withReact.ts";

function outcome(failure: unknown) {
	if (Predicate.isTagged(failure, "InvalidSettings") && Predicate.hasProperty(failure, "field") && Predicate.hasProperty(failure, "message")) {
		return `rejected as InvalidSettings on ${String(failure.field)}: ${String(failure.message)}`;
	}
	return Predicate.hasProperty(failure, "_tag") ? `rejected as ${String(failure._tag)}` : "failed";
}

export function request(url: string, token: string, entityId: number, input?: typeof Settings.Type) {
	const client = makeClient(url, token, entityId);
	const operation = input === undefined ? client.api.get.run({ entityId }) : client.api.save.run({ entityId, ...input });
	const answer = operation.pipe(Effect.match({ onFailure: outcome, onSuccess: (row) => `answered ${row.title} / ${row.pageSize}` }));
	return Effect.acquireUseRelease(
		Effect.sync(() => AtomRegistry.make()),
		(registry) => withReact(AtomRegistry.getResult(registry, client.Client.runtime.atom(answer))),
		(registry) => Effect.sync(() => registry.dispose()),
	);
}

import { Effect } from "effect";
import type { AttentionOwner } from "#attention.ts";
import { Fleet } from "#fleet.ts";
import { type HostParts, hostLayer, productionParts } from "#host/commands.ts";
import type { FleetHost } from "#host/config.ts";

export function reassignWork(
	host: FleetHost,
	workId: string,
	decisionId: string,
	attentionOwner: AttentionOwner,
	parts: HostParts = productionParts(host),
) {
	return Effect.gen(function* () {
		return yield* (yield* Fleet).reassign(workId, decisionId, attentionOwner);
	}).pipe(Effect.provide(hostLayer(host, parts)));
}

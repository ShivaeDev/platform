import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import { reassignCommand } from "#engine/reassignCommand.ts";
import type { FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export function ensureDecisionOwner(state: EngineState) {
	return Effect.fn("Fleet.ensureDecisionOwner")(function* (stored: Versioned<FleetRecord>) {
		const decision = stored.value.decision;
		const owner = stored.value.attentionOwner ?? "orchestrator";
		if (stored.value.stage !== "needs-human" || decision === undefined || decision.attentionOwner === owner) {
			return stored;
		}
		return yield* reassignCommand(state)(stored.value.workId, decision.id, owner);
	});
}

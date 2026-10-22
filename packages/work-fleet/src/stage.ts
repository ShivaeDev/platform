import { Schema } from "effect";
import { waitingOwner } from "#attention.ts";
import { FleetRecord } from "#model.ts";

export const StageInput = Schema.Struct({
	attentionOwner: FleetRecord.fields.attentionOwner,
	blocker: FleetRecord.fields.blocker,
	checks: Schema.optional(Schema.Struct({ pending: Schema.optional(Schema.Boolean) })),
	decision: Schema.optional(Schema.Struct({ attentionOwner: FleetRecord.fields.attentionOwner })),
	launchRetry: Schema.optional(Schema.Struct({ retryAt: Schema.Number })),
	step: Schema.String,
});
type Stage = FleetRecord["stage"];
export function fleetStage(record: Parameters<typeof waitingOwner>[0]): Stage {
	if (record.step === "done" || record.step === "released") {
		return record.step;
	}
	if (waitingOwner(record) !== undefined) {
		return "waiting";
	}
	if (record.step === "queued") {
		return "queued";
	}
	if (["reviewing", "validating", "delivering"].includes(record.step)) {
		return "reviewing";
	}
	return "working";
}
export function waitingReason(
	record: Parameters<typeof waitingOwner>[0] & { readonly decision?: { readonly reason?: string | undefined } | undefined },
) {
	if (waitingOwner(record) === undefined) {
		return undefined;
	}
	if (record.blocker !== undefined) {
		return record.blocker;
	}
	if (record.decision?.reason !== undefined) {
		return record.decision.reason;
	}
	if (record.launchRetry) {
		return "Waiting for provider capacity";
	}
	return record.checks?.pending ? "Waiting for required checks" : undefined;
}

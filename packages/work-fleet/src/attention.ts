import { Schema } from "effect";

export const AttentionOwner = Schema.Literals(["maintainer", "orchestrator", "automation"]);
export type AttentionOwner = typeof AttentionOwner.Type;

export const ANSWER_RECORDED = "Answer recorded; applying in the background";

export function waitingOwner(record: {
	readonly attentionOwner?: AttentionOwner | undefined;
	readonly blocker?: string | undefined;
	readonly checks?: { readonly pending?: boolean | undefined } | undefined;
	readonly decision?: { readonly attentionOwner?: AttentionOwner | undefined } | undefined;
	readonly launchRetry?: { readonly retryAt: number } | undefined;
	readonly step: string;
}): AttentionOwner | undefined {
	if (record.blocker === ANSWER_RECORDED) {
		return "automation";
	}
	if (record.launchRetry !== undefined || (record.step === "queued" && record.blocker?.startsWith("waiting for dependency "))) {
		return "automation";
	}
	if (record.step === "waiting") {
		return record.attentionOwner ?? record.decision?.attentionOwner ?? "orchestrator";
	}
	if (record.blocker !== undefined) {
		return record.attentionOwner ?? "orchestrator";
	}
	return record.step === "validating" && record.checks?.pending ? "automation" : undefined;
}

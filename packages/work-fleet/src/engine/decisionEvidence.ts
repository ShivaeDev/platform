import type { DecisionCode } from "#DecisionCode.ts";
import type { FleetRecord } from "#model.ts";

export function decisionEvidence(record: FleetRecord, code: DecisionCode) {
	const review = code === "reviewed-pr-ready" && record.review?.head === record.result?.head ? record.review?.document : undefined;
	return {
		links: [...(record.result?.kind === "change" ? [record.result.pr] : []), ...(review === undefined ? [] : [review.publication.sourcePath])],
		...(review === undefined ? {} : { review }),
	};
}

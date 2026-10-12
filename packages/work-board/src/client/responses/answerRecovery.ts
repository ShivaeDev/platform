import { Schema } from "effect";
import type { ResponseInput } from "./formSchema.ts";

export const AnswerRecovery = Schema.Union([
	Schema.String,
	Schema.Struct({
		contexts: Schema.Array(Schema.Struct({ context: Schema.String, text: Schema.String })),
		legacy: Schema.optionalKey(Schema.String),
	}),
	Schema.Undefined,
]);
type Recovery = typeof AnswerRecovery.Encoded;
const HEADING = "Earlier template answers (selections cleared; review before choosing again):";

export function answerRecovery(draft: Pick<ResponseInput, "answers" | "question" | "revision" | "recovery">, same: boolean): Recovery {
	if (same || !draft.answers?.some((answer) => answer.selected.length > 0 || answer.text.length > 0)) {
		return draft.recovery;
	}
	const context = JSON.stringify([draft.question, draft.revision]);
	const text = JSON.stringify(draft.answers, null, 2);
	const recovered = typeof draft.recovery === "string" ? { contexts: [], legacy: draft.recovery } : (draft.recovery ?? { contexts: [] });
	const existing = recovered.contexts.some((entry) => entry.context === context);
	const contexts = existing
		? recovered.contexts.map((entry) => (entry.context === context ? { context, text } : entry))
		: [...recovered.contexts, { context, text }];
	const legacy = recovered.legacy?.replaceAll(`${HEADING}\n${text}\n`, "");
	return { contexts, ...(legacy ? { legacy } : {}) };
}

export function recoveryText(recovery: Recovery): string {
	if (typeof recovery === "string") {
		return recovery;
	}
	return [...(recovery?.contexts ?? []).map((entry) => `${HEADING}\nReviewed context: ${entry.context}\n${entry.text}`), recovery?.legacy ?? ""]
		.filter(Boolean)
		.join("\n");
}

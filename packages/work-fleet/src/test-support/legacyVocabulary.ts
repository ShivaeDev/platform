import { Schema } from "effect";

const object = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown));
const oldStages: Readonly<Record<string, string>> = { done: "completed", queued: "prepared", waiting: "needs-human", working: "executing" };

export function legacyVocabulary(record: object): Readonly<Record<string, unknown>> {
	const { step, stage, history, ...fields } = object(record);
	const archived = Array.isArray(history) ? history.map(legacyVocabulary) : history;
	if (typeof step !== "string") {
		return { ...fields, history: archived, stage };
	}
	return { ...fields, history: archived, stage: oldStages[step] ?? step };
}

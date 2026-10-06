import { join } from "node:path";
import { Schema } from "effect";
import { stringify } from "yaml";
import type { Handoff, HandoffInput, HandoffRecord } from "#browser/handoffs/schema.ts";
import { HandoffRecord as RecordSchema } from "#browser/handoffs/schema.ts";
import type { MetadataDocument } from "#metadata/model.ts";

export function handoffFrom(document: MetadataDocument | undefined, root: string): Handoff | undefined {
	if (!document) {
		return undefined;
	}
	const { id, kind, handoff } = document.parsed.fields;
	return id && kind === "handoff" && handoff
		? { context: document.parsed.body, file: document.file, handoff, id, prompt: handoffPrompt(join(root, document.file)) }
		: undefined;
}
export function handoffPrompt(path: string): string {
	return `Read the handoff at ${JSON.stringify(path)}. Record receipt by editing its handoff.state and add handoff.by/note; then follow its instructions.`;
}
export function handoffMarkdown(id: string, handoff: HandoffRecord, context: string): string {
	return `---\n${stringify({ handoff: Schema.encodeSync(RecordSchema)(handoff), id, kind: "handoff" })}---\n${context}`;
}
export function matchesHandoff(record: Handoff, input: HandoffInput) {
	const saved = record.handoff;
	return (
		saved.item === input.item
		&& saved.source === input.source
		&& saved.reviewedRevision === input.revision
		&& saved.recipient === input.recipient
		&& saved.goal === input.goal
		&& saved.constraints === input.constraints
		&& saved.nextAction === input.nextAction
	);
}

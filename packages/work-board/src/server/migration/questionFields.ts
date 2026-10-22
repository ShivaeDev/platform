import { Schema } from "effect";
import { Metadata } from "#metadata/schema.ts";
import { decisionClosed } from "#server/migration/decisionClosed.ts";
import { states } from "#server/migration/oldVocabulary.ts";
import type { MigrationContext } from "#server/migration/source.ts";
import type { sourceEdits } from "#server/migration/sourceEdits.ts";
import type { sourceHeader } from "#server/migration/sourceHeader.ts";

function questionDefaults(header: NonNullable<ReturnType<typeof sourceHeader>>, edits: ReturnType<typeof sourceEdits>, context: MigrationContext) {
	const { doc } = header;
	if (!doc.has("scope")) {
		edits.set("scope", "task");
	}
	if (!doc.has("urgency")) {
		edits.set("urgency", context.blocking.has(String(doc.get("id"))) ? "blocking" : "whenever");
	}
}

function setQuestionField(
	header: NonNullable<ReturnType<typeof sourceHeader>>,
	edits: ReturnType<typeof sourceEdits>,
	field: "scope" | "status" | "urgency",
	value: string,
) {
	const current = header.doc.get(field);
	const mapped = field === "status" && typeof current === "string" ? (states[current] ?? current) : current;
	if (Schema.is(Metadata.to.fields[field])(mapped)) {
		edits.set(field, value);
	}
}

export function questionFields(
	source: string,
	header: NonNullable<ReturnType<typeof sourceHeader>>,
	edits: ReturnType<typeof sourceEdits>,
	context: MigrationContext,
) {
	const { doc, end } = header;
	const kind = doc.get("kind");
	if (kind === "question") {
		questionDefaults(header, edits, context);
		return;
	}
	if (kind !== "decision") {
		return;
	}
	const body = source.slice(end).replace(/^---[^\S\r\n]*\r?\n/u, "");
	const standing = context.file.startsWith("decisions/") && body.trim() !== "";
	const answer = standing ? body : context.answers.get(String(doc.get("id")));
	const done = standing || (decisionClosed(header) ?? answer !== undefined);
	setQuestionField(header, edits, "scope", standing ? "standing" : "task");
	setQuestionField(header, edits, "status", done ? "done" : "ready");
	setQuestionField(header, edits, "urgency", done ? "whenever" : "blocking");
	if (answer !== undefined) {
		edits.set("answer", answer);
	}
}

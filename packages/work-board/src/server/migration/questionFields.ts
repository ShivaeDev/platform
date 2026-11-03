import { Schema } from "effect";
import { Metadata } from "#metadata/schema.ts";
import { decisionClosed } from "#server/migration/adapters/decisionClosed.ts";
import type { sourceEdits } from "#server/migration/adapters/sourceEdits.ts";
import type { sourceHeader } from "#server/migration/adapters/sourceHeader.ts";
import { states } from "#server/migration/oldVocabulary.ts";
import type { MigrationContext } from "#server/migration/source.ts";

function questionDefaults(header: NonNullable<ReturnType<typeof sourceHeader>>, edits: ReturnType<typeof sourceEdits>, context: MigrationContext) {
	const { data } = header;
	if (!Object.hasOwn(data, "scope")) {
		edits.set("scope", "task");
	}
	if (!Object.hasOwn(data, "urgency")) {
		edits.set("urgency", context.blocking.has(String(data.id)) ? "blocking" : "whenever");
	}
}

function setQuestionField(
	header: NonNullable<ReturnType<typeof sourceHeader>>,
	edits: ReturnType<typeof sourceEdits>,
	field: "scope" | "status" | "urgency",
	value: string,
) {
	const current = header.data[field];
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
	const { data, end } = header;
	const kind = data.kind;
	if (kind === "question") {
		questionDefaults(header, edits, context);
		return;
	}
	if (kind !== "decision") {
		return;
	}
	const body = source.slice(end).replace(/^---[^\S\r\n]*\r?\n/u, "");
	const standing = context.file.startsWith("decisions/") && body.trim() !== "";
	const answered = context.answers.has(String(data.id));
	const done = standing || (decisionClosed(header) ?? answered);
	setQuestionField(header, edits, "scope", standing ? "standing" : "task");
	setQuestionField(header, edits, "status", done ? "done" : "ready");
	setQuestionField(header, edits, "urgency", done ? "whenever" : "blocking");
}

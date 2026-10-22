import { Schema } from "effect";
import { Metadata } from "#metadata/schema.ts";
import { states } from "#server/migration/oldVocabulary.ts";
import type { MigrationContext } from "#server/migration/source.ts";
import type { sourceEdits } from "#server/migration/sourceEdits.ts";
import type { sourceHeader } from "#server/migration/sourceHeader.ts";

export function questionFields(
	source: string,
	header: NonNullable<ReturnType<typeof sourceHeader>>,
	edits: ReturnType<typeof sourceEdits>,
	context: MigrationContext,
) {
	const { doc, end } = header;
	const kind = doc.get("kind");
	if (kind === "question") {
		if (!doc.has("scope")) {
			edits.set("scope", "task");
		}
		if (!doc.has("urgency")) {
			edits.set("urgency", context.blocking.has(String(doc.get("id"))) ? "blocking" : "whenever");
		}
		return;
	}
	if (kind !== "decision") {
		return;
	}
	const body = source.slice(end).replace(/^---[^\S\r\n]*\r?\n/u, "");
	const standing = context.file.startsWith("decisions/") && body.trim() !== "";
	const answer = standing ? body : context.answers.get(String(doc.get("id")));
	function set(field: "scope" | "status" | "urgency", value: string) {
		const current = doc.get(field);
		const mapped = field === "status" && typeof current === "string" ? (states[current] ?? current) : current;
		if (Schema.is(Metadata.to.fields[field])(mapped)) {
			edits.set(field, value);
		}
	}
	set("scope", standing ? "standing" : "task");
	set("status", answer === undefined ? "ready" : "done");
	set("urgency", answer === undefined ? "blocking" : "whenever");
	if (answer !== undefined) {
		edits.set("answer", answer);
	}
}

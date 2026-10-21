import type { sourceEdits } from "./sourceEdits.ts";
import type { sourceHeader } from "./sourceHeader.ts";

export function questionFields(
	source: string,
	header: NonNullable<ReturnType<typeof sourceHeader>>,
	edits: ReturnType<typeof sourceEdits>,
	blocking: ReadonlySet<string>,
) {
	const { doc, end } = header;
	const kind = doc.get("kind");
	if (kind !== "decision" && kind !== "question") {
		return;
	}
	if (kind === "decision" || !doc.has("scope")) {
		edits.set("scope", kind === "decision" ? "standing" : "task");
	}
	if (!doc.has("urgency")) {
		edits.set("urgency", blocking.has(String(doc.get("id"))) ? "blocking" : "whenever");
	}
	if (kind !== "decision") {
		return;
	}
	edits.set("status", "done");
	if (!doc.has("answer")) {
		edits.set("answer", source.slice(end).replace(/^---[^\S\r\n]*\r?\n/u, ""));
	}
}

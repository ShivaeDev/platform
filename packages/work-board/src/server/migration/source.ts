import { kinds, oldOwner, states } from "#server/migration/oldVocabulary.ts";
import { questionFields } from "#server/migration/questionFields.ts";
import { sourceEdits } from "#server/migration/sourceEdits.ts";
import { sourceHeader } from "#server/migration/sourceHeader.ts";

export interface MigrationContext {
	readonly answers: ReadonlyMap<string, string>;
	readonly blocking: ReadonlySet<string>;
	readonly file: string;
	readonly replaces: readonly string[];
}
export function migrateSource(source: string, context: MigrationContext) {
	const header = sourceHeader(source);
	if (!header) {
		return { fields: 0, source };
	}
	const edits = sourceEdits(source, header);
	const { doc } = header;
	function mapped(field: string, values: Readonly<Record<string, string>>) {
		const value = doc.get(field);
		if (typeof value === "string" && values[value]) {
			edits.set(field, values[value]);
		}
	}
	mapped("kind", kinds);
	if (["response", "handoff", "board"].includes(String(doc.get("kind")))) {
		edits.remove("kind");
	}
	edits.remove("superseded_by");
	edits.remove("replaced_by");
	if (doc.get("kind") !== "decision") {
		mapped("status", states);
	}
	const owner = doc.get("owner");
	const responsible = typeof owner === "string" ? oldOwner(owner) : undefined;
	if (responsible) {
		edits.set("owner", responsible);
	}
	mapped("fleet", { draft: "held", none: "manual", released: "held" });
	edits.rename("fleet-deliverable", "delivers");
	questionFields(source, header, edits, context);
	edits.replaces(context.replaces);
	return edits.finish();
}

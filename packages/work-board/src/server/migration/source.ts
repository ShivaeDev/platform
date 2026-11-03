import { sourceEdits } from "#server/migration/adapters/sourceEdits.ts";
import { sourceHeader } from "#server/migration/adapters/sourceHeader.ts";
import { kinds, oldOwner, states } from "#server/migration/oldVocabulary.ts";
import { questionFields } from "#server/migration/questionFields.ts";

export interface MigrationContext {
	readonly answers: ReadonlySet<string>;
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
	const { data } = header;
	function mapped(field: string, values: Readonly<Record<string, string>>) {
		const value = data[field];
		if (typeof value === "string" && values[value]) {
			edits.set(field, values[value]);
		}
	}
	mapped("kind", kinds);
	if (["response", "handoff", "board"].includes(String(data.kind))) {
		edits.remove("kind");
	}
	edits.remove("superseded_by");
	edits.remove("replaced_by");
	if (data.kind !== "decision") {
		mapped("status", states);
	}
	const owner = data.owner;
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

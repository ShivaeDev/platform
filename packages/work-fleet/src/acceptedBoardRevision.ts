import { isDeepStrictEqual } from "node:util";
import { parseDocument } from "yaml";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { boardDiagnostics } from "#board/fleetField.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";

export function acceptedBoardRevision(record: FleetRecord, current: BoardWork): boolean {
	if (record.boardRevision === current.revision) {
		return true;
	}
	if (current.status !== "done" || record.boardContext === undefined || record.boardSourcePath !== current.sourcePath) {
		return false;
	}
	const accepted = workContent(record.boardContext, record.workId);
	const authored = metadataParse(current.context);
	return authored.fields.status === "done" && accepted !== undefined && isDeepStrictEqual(accepted, workContent(current.context, current.workId));
}

function workContent(source: string, workId: string) {
	const parsed = metadataParse(source);
	if (parsed.raw === undefined || parsed.fields.id !== workId || boardDiagnostics(parsed).length > 0) {
		return undefined;
	}
	const lines = parsed.raw.split(/\r?\n/u);
	const closing = lines.findLastIndex((line) => line.trimEnd() === "---");
	const fields: unknown = parseDocument(lines.slice(1, closing).join("\n")).toJS({ maxAliasCount: 50 });
	if (typeof fields !== "object" || fields === null || Array.isArray(fields)) {
		return undefined;
	}
	const frontmatter = new Map(Object.entries(fields));
	frontmatter.delete("status");
	frontmatter.delete("next_action");
	return { body: parsed.body, frontmatter };
}

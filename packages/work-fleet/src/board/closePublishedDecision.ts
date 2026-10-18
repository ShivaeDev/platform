import { Effect } from "effect";
import { parseDocument } from "yaml";
import { board } from "@shivaedev/work-board/integration/board.ts";
import type { BoardDocument } from "#board/documents.ts";
import { recordBoardSource } from "#board/readPass.ts";
import { writeCompletion } from "#board/writeCompletion.ts";
import { BoardFailure } from "#policy.ts";

export function publishedDecision(document: BoardDocument) {
	const { fields, body, diagnostics } = document.parsed;
	const workId = fields.relationships?.find((relation) => relation.kind === "relates_to")?.target;
	const request = fields.attention?.[0];
	if (
		diagnostics.length > 0
		|| fields.kind !== "decision"
		|| !fields.id?.startsWith("decision.")
		|| workId === undefined
		|| !body.startsWith(`# Fleet decision for ${workId}\n`)
		|| fields.attention?.length !== 1
		|| request?.managed !== true
		|| !request.id.startsWith(`${workId}.`)
	) {
		return;
	}
	const sequence = Number(request.id.slice(workId.length + 1));
	return Number.isSafeInteger(sequence) ? { request, sequence, workId } : undefined;
}

export const closePublishedDecision = Effect.fn("FleetBoard.closePublishedDecision")(function* (
	root: string,
	realRoot: string,
	document: BoardDocument,
) {
	const decision = publishedDecision(document);
	if (decision === undefined || decision.request.state !== "open") {
		return;
	}
	const header = document.parsed.raw;
	if (header === undefined) {
		return;
	}
	const metadata = parseDocument(header.replace(/^---\r?\n/u, "").replace(/---\r?\n?$/u, ""));
	metadata.setIn(["attention", 0, "state"], "closed");
	const content = `---\n${metadata.toString()}---\n${document.parsed.body}`;
	yield* writeCompletion(root, realRoot, document.file, document.source, content).pipe(
		Effect.mapError((error) => new BoardFailure({ message: error.message })),
	);
	const parsed = board.metadataParse(content);
	yield* recordBoardSource(realRoot, document.file, content, parsed);
	return { file: document.file, parsed, source: content };
});

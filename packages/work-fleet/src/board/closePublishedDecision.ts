import { Effect } from "effect";
import { parseDocument } from "yaml";
import { board } from "@shivaedev/work-board/server/integration/board.ts";
import { Publication, replaceIfUnchanged } from "@shivaedev/work-board/server/publication.ts";
import type { BoardDocument } from "#board/documents.ts";
import { recordBoardSource } from "#board/readPass.ts";
import { BoardFailure } from "#policy.ts";

export function publishedDecision(document: BoardDocument) {
	const { fields, body, diagnostics } = document.parsed;
	const workId = fields.relationships?.find((relation) => relation.kind === "relates_to")?.target;
	const request = fields.attention?.[0];
	if (
		diagnostics.length > 0
		|| fields.kind !== "question"
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
	reason?: string,
) {
	const request = document.parsed.fields.attention?.[0];
	if (request?.state !== "open") {
		return;
	}
	const header = document.parsed.raw;
	if (header === undefined) {
		return;
	}
	const metadata = parseDocument(header.replace(/^---\r?\n/u, "").replace(/---\r?\n?$/u, ""));
	metadata.setIn(["attention", 0, "state"], "closed");
	metadata.set("status", "done");
	if (reason !== undefined) {
		metadata.set("next_action", reason);
	}
	const content = `---\n${metadata.toString()}---\n${document.parsed.body}`;
	const written = yield* replaceIfUnchanged({ content, expectedSource: document.source, path: document.file, realRoot, root }).pipe(
		Effect.provide(Publication.layer),
		Effect.as(true),
		Effect.catchTag("PreconditionFailed", () => Effect.succeed(false)),
		Effect.mapError((error) => new BoardFailure({ message: error.message })),
	);
	if (!written) {
		return;
	}
	const parsed = board.metadataParse(content);
	yield* recordBoardSource(realRoot, document.file, content, parsed);
	return { file: document.file, parsed, source: content };
});

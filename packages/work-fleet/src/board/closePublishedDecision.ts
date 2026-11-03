import { Effect } from "effect";
import type { MetadataDocument as BoardDocument } from "@shivaedev/work-board/integration/metadata.ts";
import { documentSource } from "@shivaedev/work-board/server/metadata/model.ts";
import { Workspace } from "@shivaedev/work-board/server/workspace.ts";
import { recordBoardWrite } from "#board/readPass.ts";
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
	realRoot: string,
	document: BoardDocument,
	reason?: string,
) {
	const request = document.parsed.fields.attention?.[0];
	if (request?.state !== "open") {
		return;
	}
	const input = {
		file: document.file,
		request: request.id,
		source: documentSource(document),
		...(reason === undefined ? {} : { nextAction: reason }),
	};
	const workspace = yield* Workspace;
	const updated = yield* workspace.closeDecision(input).pipe(
		Effect.catchTag("PreconditionFailed", () => Effect.succeed(undefined)),
		Effect.mapError((error) => new BoardFailure({ message: error.message })),
	);
	if (updated) {
		yield* recordBoardWrite(realRoot, updated.file);
	}
	return updated;
});

import { relative } from "node:path";
import { Effect } from "effect";
import type { Reading } from "@shivaedev/work-board/browser/responses/schema.ts";
import { metadataModel } from "@shivaedev/work-board/metadata/model.ts";
import { readResponses } from "@shivaedev/work-board/responses/read.ts";
import { questionId, revisionOf } from "@shivaedev/work-board/responses/records.ts";
import type { BoardDocument } from "#board/documents.ts";
import type { BoardDecision, BoardDecisionReading } from "#board/schema.ts";
import { BoardFailure, type BoardWork } from "#policy.ts";

function currentResponse(reading: Reading): BoardDecisionReading {
	const superseded = new Set(reading.responses.flatMap((response) => (response.response.supersedes ? [response.response.supersedes] : [])));
	const current = reading.responses.filter((response) => !superseded.has(response.id));
	if (current.length === 0 && reading.responses.length === 0) {
		return { _tag: "Pending" };
	}
	if (current.length !== 1 || !current[0]) {
		return { _tag: "Ambiguous", responseIds: current.map((response) => response.id) };
	}
	return { _tag: "Response", response: current[0] };
}

export function decisionReading(
	realRoot: string,
	documents: Effect.Effect<readonly BoardDocument[], BoardFailure>,
	get: (id: string) => Effect.Effect<BoardWork, BoardFailure>,
) {
	return Effect.fn("FleetBoard.readDecision")(function* (receipt: BoardDecision): Effect.fn.Return<BoardDecisionReading, BoardFailure> {
		const work = yield* get(receipt.workId);
		if (work.revision !== receipt.workRevision || relative(realRoot, work.sourcePath) !== receipt.workSourcePath) {
			return { _tag: "Stale", reason: "Board work changed or moved since this decision was published." };
		}
		const all = yield* documents;
		const model = metadataModel(all);
		const matches = model.ids.get(receipt.itemId);
		const document = matches?.length === 1 ? all.find((entry) => entry.file === matches[0]?.file) : undefined;
		if (!document || document.file !== receipt.sourcePath || revisionOf(document.source) !== receipt.revision) {
			return { _tag: "Stale", reason: "The decision source changed, moved or became ambiguous." };
		}
		if (
			document.parsed.fields.kind !== "decision"
			|| document.parsed.fields.attention?.filter((request) => request.id === receipt.request && request.state === "open").length !== 1
			|| questionId(receipt.itemId, receipt.request, receipt.revision, receipt.sourcePath) !== receipt.questionId
		) {
			return { _tag: "Stale", reason: "The exact open decision request is unavailable." };
		}
		const snapshot = Effect.succeed({ documents: all, entries: [], model, revision: 0, unavailable: [] });
		const reading = yield* readResponses(snapshot)(receipt.questionId).pipe(
			Effect.mapError(() => new BoardFailure({ message: "Fleet decision response history is incomplete or ambiguous." })),
		);
		if (
			reading.question.question.item !== receipt.itemId
			|| reading.question.question.request !== receipt.request
			|| reading.question.question.source !== receipt.sourcePath
			|| reading.question.question.reviewedRevision !== receipt.revision
			|| reading.question.context !== document.source
		) {
			return { _tag: "Stale", reason: "The registered question does not match the reviewed decision context." };
		}
		return currentResponse(reading);
	});
}

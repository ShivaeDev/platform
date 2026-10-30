import { Effect } from "effect";
import { board } from "@shivaedev/work-board/server/integration/board.ts";
import type { Reading } from "@shivaedev/work-board/server/integration/responses.ts";
import { responses } from "@shivaedev/work-board/server/integration/responses.ts";
import type { BoardDocument } from "#board/documents.ts";
import type { BoardDecision, BoardDecisionReading } from "#board/schema.ts";
import { BoardFailure } from "#policy.ts";

const { metadataModel, metadataParse } = board;
const { currentResponses, questionId, readResponses, questionSourceMatches } = responses;

function currentResponse(reading: Reading): BoardDecisionReading {
	const current = currentResponses(reading.responses);
	if (current.length === 0 && reading.responses.length === 0) {
		return { _tag: "Pending" };
	}
	if (current.length !== 1 || !current[0]) {
		return { _tag: "Ambiguous", responseIds: current.map((response) => response.id) };
	}
	return { _tag: "Response", response: current[0] };
}

// Closing a decision rewrites only its metadata, so a closed decision still carries the reviewed body.
function reviewedQuestion(question: Reading["question"], receipt: BoardDecision, document: BoardDocument, closed: boolean) {
	return (
		question.question.item === receipt.itemId
		&& question.question.request === receipt.request
		&& question.question.source === receipt.sourcePath
		&& question.question.reviewedRevision === receipt.revision
		&& (closed ? metadataParse(question.context).body === document.parsed.body : questionSourceMatches(question, document))
	);
}

export function decisionReading(
	documents: Effect.Effect<readonly BoardDocument[], BoardFailure>,
	archivedDocuments?: (item: string) => Effect.Effect<readonly BoardDocument[], BoardFailure>,
) {
	return Effect.fn("FleetBoard.readDecision")(function* (receipt: BoardDecision): Effect.fn.Return<BoardDecisionReading, BoardFailure> {
		const all = yield* archivedDocuments?.(receipt.itemId) ?? documents;
		const model = metadataModel(all);
		const matches = model.ids.get(receipt.itemId);
		const document = matches?.length === 1 ? all.find((entry) => entry.file === matches[0]?.file) : undefined;
		if (!document || document.file !== receipt.sourcePath) {
			return { _tag: "Stale", reason: "The decision source changed, moved or became ambiguous." };
		}
		const requests = document.parsed.fields.attention?.filter((request) => request.id === receipt.request) ?? [];
		if (
			document.parsed.fields.kind !== "question"
			|| requests.length !== 1
			|| questionId(receipt.itemId, receipt.request, receipt.revision, receipt.sourcePath) !== receipt.questionId
		) {
			return { _tag: "Stale", reason: "The exact open decision request is unavailable." };
		}
		const closed = requests[0]?.state === "closed";
		const snapshot = Effect.succeed({ documents: all, entries: [], model, modified: new Map<string, number>(), revision: 0, unavailable: [] });
		const reading = yield* readResponses(snapshot)(receipt.questionId).pipe(
			Effect.mapError(() => new BoardFailure({ message: "Fleet decision response history is incomplete or ambiguous." })),
		);
		if (!reviewedQuestion(reading.question, receipt, document, closed)) {
			return { _tag: "Stale", reason: "The registered question does not match the reviewed decision context." };
		}
		return closed ? { _tag: "Closed" } : currentResponse(reading);
	});
}

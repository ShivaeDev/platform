import { Effect } from "effect";
import type { MetadataDocument as BoardDocument } from "@shivaedev/work-board/integration/metadata.ts";
import { metadataParse } from "@shivaedev/work-board/metadata/adapters/parse.ts";
import type { Reading } from "@shivaedev/work-board/server/integration/responses.ts";
import { responses } from "@shivaedev/work-board/server/integration/responses.ts";
import type { Snapshot } from "@shivaedev/work-board/server/search/snapshot.ts";
import type { BoardDecision, BoardDecisionReading } from "#board/schema.ts";
import { metadataProblem } from "#board/workPolicy.ts";
import { BoardFailure } from "#policy.ts";

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

function selectedSource(snapshot: Snapshot, receipt: BoardDecision) {
	const matches = snapshot.model.ids.get(receipt.itemId);
	const document = matches?.length === 1 ? matches[0] : undefined;
	return document && document.file === receipt.sourcePath && metadataProblem(document) === undefined ? document : undefined;
}

export function decisionReading(snapshot: Effect.Effect<Snapshot, BoardFailure>, archived?: (item: string) => Effect.Effect<Snapshot, BoardFailure>) {
	return Effect.fn("FleetBoard.readDecision")(function* (receipt: BoardDecision): Effect.fn.Return<BoardDecisionReading, BoardFailure> {
		const current = yield* archived?.(receipt.itemId) ?? snapshot;
		if (current.unavailable.length > 0) {
			return yield* Effect.fail(
				new BoardFailure({ code: "incomplete-observation", message: `Board sources are unavailable: ${current.unavailable.join(", ")}` }),
			);
		}
		const document = selectedSource(current, receipt);
		if (document === undefined) {
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
		const reading = yield* readResponses(Effect.succeed(current))(receipt.questionId).pipe(
			Effect.mapError(() => new BoardFailure({ message: "Fleet decision response history is incomplete or ambiguous." })),
		);
		if (!reviewedQuestion(reading.question, receipt, document, closed)) {
			return { _tag: "Stale", reason: "The registered question does not match the reviewed decision context." };
		}
		return closed ? { _tag: "Closed" } : currentResponse(reading);
	});
}

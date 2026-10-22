import { Effect } from "effect";
import { attention } from "@shivaedev/work-board/server/integration/attention.ts";
import { board as boardApi } from "@shivaedev/work-board/server/integration/board.ts";
import { responses } from "@shivaedev/work-board/server/integration/responses.ts";
import { closePublishedDecision } from "#board/closePublishedDecision.ts";
import type { BoardDocument } from "#board/documents.ts";
import { type BoardSnapshot, recordBoardSource } from "#board/readPass.ts";
import { reviewedDecision } from "#board/reviewedDecision.ts";
import { BoardAcknowledgementStale, type BoardDecisionAcknowledgement } from "#board/schema.ts";
import { BoardFailure } from "#policy.ts";

const { managedRequestReceipt } = attention;
const { metadataModel } = boardApi;
const { publish, revisionOf } = responses;

export function acknowledgeDecision(root: string, realRoot: string, snapshot: Effect.Effect<BoardSnapshot, BoardFailure>) {
	return Effect.fn("FleetBoard.acknowledgeDecision")(function* (input: BoardDecisionAcknowledgement) {
		const current = yield* snapshot;
		const incomplete = Array.from(current.problems.values()).find((problem) => problem.code === "incomplete-observation");
		if (incomplete !== undefined) {
			return yield* Effect.fail(incomplete);
		}
		const all = current.documents.filter((document) => !current.problems.has(document.file));
		const decision = input.decision;
		const requestReceipt = {
			disposition: input.disposition,
			question: decision.questionId,
			recordedAt: input.recordedAt,
			reviewedRevision: decision.revision,
			...(input.responseId === undefined ? {} : { response: input.responseId }),
		};
		const id = `request-receipt.${revisionOf(JSON.stringify(requestReceipt))}`;
		const content = `---\n${JSON.stringify({ id, kind: "report", "request_receipt": requestReceipt })}\n---\n# Managed request acknowledgement\n\nThis immutable receipt acknowledges request handling; it grants no execution, acceptance or delivery authority.\n`;
		const file = `responses/${id}.md`;
		const source = all.find((document) => document.file === decision.sourcePath);
		const request = source?.parsed.fields.attention?.find((candidate) => candidate.id === decision.request);
		if (
			source?.parsed.fields.status === "done"
			&& request?.state === "closed"
			&& all.some((document) => document.file === file && document.source === content)
		) {
			return;
		}
		if (!(source && reviewedDecision(decision, source, all))) {
			return yield* Effect.fail(
				new BoardAcknowledgementStale({ message: "The decision source changed or moved; its request cannot be acknowledged." }),
			);
		}
		const receiptDocument = { file, parsed: boardApi.metadataParse(content) };
		const others = all.filter((document) => document.file !== file);
		const acknowledged = others.some((document) => document.parsed.fields.requestReceipt?.question === decision.questionId);
		const model = metadataModel([...others, receiptDocument]);
		if (!request || acknowledged || managedRequestReceipt(source, request, model) === undefined) {
			return yield* Effect.fail(
				new BoardAcknowledgementStale({ message: "The exact managed question and applicable response cannot be qualified for acknowledgement." }),
			);
		}
		yield* publish(root, realRoot, id, content).pipe(
			Effect.mapError(() => new BoardFailure({ message: "The managed request acknowledgement could not be recorded on Board." })),
		);
		yield* recordBoardSource(realRoot, file, content, receiptDocument.parsed);
		const reason = input.disposition === "superseded" ? supersededReason(all, decision.workId) : undefined;
		yield* closePublishedDecision(root, realRoot, source, reason);
	});
}

function supersededReason(documents: readonly BoardDocument[], workId: string) {
	const work = documents.filter((document) => document.parsed.fields.id === workId);
	const status = work.length === 1 ? work[0]?.parsed.fields.status : undefined;
	return ["done", "deferred", "dropped"].includes(status ?? "")
		? `Closed because Board work ${workId} is ${status}.`
		: "Closed because this Fleet decision was superseded.";
}

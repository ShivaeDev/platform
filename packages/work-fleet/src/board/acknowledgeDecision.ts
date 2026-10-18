import { Effect } from "effect";
import { attention } from "@shivaedev/work-board/integration/attention.ts";
import { board as boardApi } from "@shivaedev/work-board/integration/board.ts";
import { responses } from "@shivaedev/work-board/integration/responses.ts";
import { type BoardSnapshot, recordBoardSource } from "#board/readPass.ts";
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
		const source = all.find((document) => document.file === decision.sourcePath);
		if (!source || source.parsed.fields.id !== decision.itemId || revisionOf(source.source) !== decision.revision) {
			return yield* Effect.fail(
				new BoardAcknowledgementStale({ message: "The decision source changed or moved; its request cannot be acknowledged." }),
			);
		}
		const request = source.parsed.fields.attention?.find((candidate) => candidate.id === decision.request);
		const requestReceipt = {
			disposition: input.disposition,
			question: decision.questionId,
			recordedAt: input.recordedAt,
			reviewedRevision: decision.revision,
			...(input.responseId === undefined ? {} : { response: input.responseId }),
		};
		const id = `request-receipt.${revisionOf(JSON.stringify(requestReceipt))}`;
		const content = `---\n${JSON.stringify({ id, kind: "result", "request_receipt": requestReceipt })}\n---\n# Managed request acknowledgement\n\nThis immutable receipt acknowledges request handling; it grants no execution, acceptance or delivery authority.\n`;
		const file = `responses/${id}.md`;
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
	});
}

import { Effect } from "effect";
import type { MetadataDocument as BoardDocument } from "@shivaedev/work-board/integration/metadata.ts";
import { managedRequestReceipt } from "@shivaedev/work-board/server/attention/managedRequestReceipt.ts";
import { board as boardApi } from "@shivaedev/work-board/server/integration/board.ts";
import { responses } from "@shivaedev/work-board/server/integration/responses.ts";
import { documentSource } from "@shivaedev/work-board/server/metadata/model.ts";
import type { Snapshot as BoardSnapshot } from "@shivaedev/work-board/server/search/snapshot.ts";
import { closePublishedDecision } from "#board/closePublishedDecision.ts";
import { recordBoardWrite } from "#board/readPass.ts";
import { reviewedDecision } from "#board/reviewedDecision.ts";
import { BoardAcknowledgementStale, type BoardDecisionAcknowledgement } from "#board/schema.ts";
import { snapshotProblems } from "#board/workPolicy.ts";
import { BoardFailure } from "#policy.ts";

const { metadataModel } = boardApi;
const { publish, revisionOf } = responses;

export function acknowledgeDecision(
	root: string,
	realRoot: string,
	snapshot: Effect.Effect<BoardSnapshot, BoardFailure>,
	select?: (item: string) => Effect.Effect<BoardSnapshot, BoardFailure>,
) {
	function read(item: string) {
		return select?.(item) ?? snapshot;
	}
	return Effect.fn("FleetBoard.acknowledgeDecision")(function* (input: BoardDecisionAcknowledgement) {
		const current = yield* read(input.decision.itemId);
		const incomplete = Array.from(snapshotProblems(current).values()).find((problem) => problem.code === "incomplete-observation");
		if (incomplete !== undefined) {
			return yield* Effect.fail(incomplete);
		}
		const all = current.documents.filter((document) => !snapshotProblems(current).has(document.file));
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
			&& all.some((document) => document.file === file && documentSource(document) === content)
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
		yield* recordBoardWrite(realRoot, file);
		const reason = input.disposition === "superseded" ? supersededReason(all, decision.workId) : undefined;
		yield* closePublishedDecision(realRoot, source, reason);
	});
}

function supersededReason(documents: readonly BoardDocument[], workId: string) {
	const work = documents.filter((document) => document.parsed.fields.id === workId);
	const status = work.length === 1 ? work[0]?.parsed.fields.status : undefined;
	return ["done", "deferred", "dropped"].includes(status ?? "")
		? `Closed because Board work ${workId} is ${status}.`
		: "Closed because this Fleet decision was superseded.";
}

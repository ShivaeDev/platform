import { Effect } from "effect";
import { managedRequestReceipt } from "@shivaedev/work-board/attention/managedRequestReceipt.ts";
import { metadataModel } from "@shivaedev/work-board/metadata/model.ts";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { publish } from "@shivaedev/work-board/responses/publish.ts";
import { revisionOf } from "@shivaedev/work-board/responses/records.ts";
import type { BoardDocument } from "#board/documents.ts";
import type { BoardDecisionAcknowledgement } from "#board/schema.ts";
import { BoardFailure } from "#policy.ts";

export function acknowledgeDecision(root: string, realRoot: string, documents: Effect.Effect<readonly BoardDocument[], BoardFailure>) {
	return Effect.fn("FleetBoard.acknowledgeDecision")(function* (input: BoardDecisionAcknowledgement) {
		const all = yield* documents;
		const decision = input.decision;
		const source = all.find((document) => document.file === decision.sourcePath);
		if (!source || source.parsed.fields.id !== decision.itemId || revisionOf(source.source) !== decision.revision) {
			return yield* Effect.fail(new BoardFailure({ message: "The decision source changed or moved; its request cannot be acknowledged." }));
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
		const receiptDocument = { file, parsed: metadataParse(content) };
		const model = metadataModel([...all.filter((document) => document.file !== file), receiptDocument]);
		if (!request || managedRequestReceipt(source, request, model) === undefined) {
			return yield* Effect.fail(
				new BoardFailure({ message: "The exact managed question and applicable response cannot be qualified for acknowledgement." }),
			);
		}
		yield* publish(root, realRoot, id, content).pipe(
			Effect.mapError(() => new BoardFailure({ message: "The managed request acknowledgement could not be recorded on Board." })),
		);
	});
}

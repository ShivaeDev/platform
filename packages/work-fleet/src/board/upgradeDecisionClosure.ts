import { Effect, type FileSystem } from "effect";
import { responses } from "@shivaedev/work-board/server/integration/responses.ts";
import { closePublishedDecision, publishedDecision } from "#board/closePublishedDecision.ts";
import type { BoardDocument } from "#board/documents.ts";
import type { BoardSnapshot } from "#board/readPass.ts";
import { writePublished } from "#board/writePublished.ts";
import { BoardFailure } from "#policy.ts";

const MARKER = ".fleet-decision-closure-v1.json";

export const upgradeDecisionClosure = Effect.fn("FleetBoard.upgradeDecisionClosure")(function* (
	root: string,
	realRoot: string,
	snapshot: BoardSnapshot,
	fs: FileSystem.FileSystem,
) {
	if (yield* fs.exists(`${realRoot}/${MARKER}`).pipe(Effect.mapError((error) => new BoardFailure({ message: error.message })))) {
		return;
	}
	if (snapshot.problems.size > 0) {
		yield* Effect.logWarning("Fleet decision closure upgrade deferred because the Board has problems", { problems: snapshot.problems.size });
		return;
	}
	const documents = snapshot.documents;
	const latest = latestSequences(documents);
	const superseded = new Set(
		documents.flatMap((document) => {
			const receipt = document.parsed.fields.requestReceipt;
			return receipt?.disposition === "superseded" ? [receipt.question] : [];
		}),
	);
	const questions = new Map(
		documents.flatMap((document) => {
			const question = responses.questionFrom(document);
			return question === undefined ? [] : [[question.question.source, question.id] as const];
		}),
	);
	for (const document of documents) {
		const decision = publishedDecision(document);
		if (decision !== undefined && (decision.sequence < (latest.get(decision.workId) ?? -1) || superseded.has(questions.get(document.file) ?? ""))) {
			const closed = yield* closePublishedDecision(root, realRoot, document);
			if (closed !== undefined) {
				snapshot.record(closed);
			}
		}
	}
	yield* writePublished(root, realRoot, MARKER, '{"version":1}\n', (source) => source === '{"version":1}\n').pipe(
		Effect.mapError((error) => new BoardFailure({ message: error.message })),
	);
});

function latestSequences(documents: readonly BoardDocument[]) {
	const latest = new Map<string, number>();
	for (const document of documents) {
		const decision = publishedDecision(document);
		if (decision !== undefined) {
			latest.set(decision.workId, Math.max(latest.get(decision.workId) ?? -1, decision.sequence));
		}
	}
	return latest;
}

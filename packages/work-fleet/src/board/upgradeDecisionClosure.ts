import { Effect, FileSystem } from "effect";
import type { MetadataDocument as BoardDocument } from "@shivaedev/work-board/integration/metadata.ts";
import { responses } from "@shivaedev/work-board/server/integration/responses.ts";
import type { Snapshot as BoardSnapshot } from "@shivaedev/work-board/server/search/snapshot.ts";
import { Workspace } from "@shivaedev/work-board/server/workspace.ts";
import { closePublishedDecision, publishedDecision } from "#board/closePublishedDecision.ts";
import { snapshotProblems } from "#board/workPolicy.ts";
import { writePublished } from "#board/writePublished.ts";
import { BoardFailure } from "#policy.ts";

const MARKER = ".fleet-decision-closure-v1.json";

export const upgradeDecisionClosure = Effect.fn("FleetBoard.upgradeDecisionClosure")(function* (
	root: string,
	realRoot: string,
	snapshot: BoardSnapshot,
) {
	const fs = yield* FileSystem.FileSystem;
	if (yield* fs.exists(`${realRoot}/${MARKER}`).pipe(Effect.mapError((error) => new BoardFailure({ message: error.message })))) {
		return;
	}
	if (snapshotProblems(snapshot).size > 0) {
		yield* Effect.logWarning("Fleet decision closure upgrade deferred because the Board has problems", { problems: snapshotProblems(snapshot).size });
		return;
	}
	const documents = snapshot.documents;
	const latest = latestSequences(documents);
	const workspace = yield* Workspace;
	for (const document of documents) {
		const decision = publishedDecision(document);
		if (decision === undefined) {
			continue;
		}
		const history = yield* workspace.archived(document.file).pipe(Effect.mapError((error) => new BoardFailure({ message: error.message })));
		if (decision.sequence < (latest.get(decision.workId) ?? -1) || wasSuperseded(history.documents, document.file)) {
			yield* closePublishedDecision(realRoot, document);
		}
	}
	yield* writePublished(root, realRoot, MARKER, '{"version":1}\n', (source) => source === '{"version":1}\n').pipe(
		Effect.mapError((error) => new BoardFailure({ message: error.message })),
	);
});

function wasSuperseded(documents: readonly BoardDocument[], source: string) {
	const questions = new Set(
		documents.flatMap((document) => {
			const question = responses.questionFrom(document);
			return question?.question.source === source ? [question.id] : [];
		}),
	);
	return documents.some(
		({ parsed }) => parsed.fields.requestReceipt?.disposition === "superseded" && questions.has(parsed.fields.requestReceipt.question),
	);
}

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

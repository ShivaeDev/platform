import { Context, Effect, FileSystem, Layer, Path, Schema } from "effect";
import { defineService } from "@shivaedev/effect-service/define-service.ts";
import { board as boardApi } from "@shivaedev/work-board/integration/board.ts";
import { acknowledgeDecision } from "#board/acknowledgeDecision.ts";
import { briefRevision } from "#board/briefRevision.ts";
import { completionMarkdown } from "#board/completionMarkdown.ts";
import { decisionReading } from "#board/decisionReading.ts";
import { boundSnapshot, refreshSnapshotDocument, snapshotDocument } from "#board/documents.ts";
import { fleetApproved, fleetDeliverable, fleetPriority } from "#board/fleetField.ts";
import { publishBoard } from "#board/publish.ts";
import { publishReport } from "#board/publishReport.ts";
import { workMetadata } from "#board/readPass.ts";
import { upgradeDecisionClosure } from "#board/upgradeDecisionClosure.ts";
import { workRevision } from "#board/workRevision.ts";
import { writeCompletion } from "#board/writeCompletion.ts";
import { BoardFailure, BoardGateway, Priority } from "#policy.ts";
import { RepositoryPath } from "#preparation/schema.ts";

class BoardRoot extends Context.Service<BoardRoot, string>()("Fleet/BoardRoot") {}

const MarkdownBoard = defineService({
	id: "Fleet/MarkdownBoard",
	initialize: Effect.gen(function* () {
		const root = yield* BoardRoot;
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const realRoot = yield* fs.realPath(root);
		const snapshot = boundSnapshot(root, realRoot, fs, path).pipe(Effect.tap((current) => upgradeDecisionClosure(root, realRoot, current, fs)));
		const documents = snapshot.pipe(Effect.map((current) => current.documents.filter((document) => !current.problems.has(document.file))));
		const get = Effect.fn("FleetBoard.get")(function* (workId: string, options?: { readonly fresh?: boolean }) {
			const current = yield* snapshot;
			const found = yield* options?.fresh
				? refreshSnapshotDocument(root, realRoot, current, workId).pipe(
						Effect.provideService(FileSystem.FileSystem, fs),
						Effect.provideService(Path.Path, path),
					)
				: snapshotDocument(current, workId);
			const deliverable = fleetDeliverable(found.parsed);
			if (deliverable !== undefined && deliverable !== "report") {
				return yield* Effect.fail(new BoardFailure({ message: "Invalid fleet-deliverable; use report or omit the field for pull requests." }));
			}
			const priority = fleetPriority(found.parsed);
			if (priority !== undefined && !Schema.is(Priority)(priority)) {
				return yield* Effect.fail(new BoardFailure({ message: "Invalid fleet-priority; use urgent, high or normal, or omit the field." }));
			}
			return {
				approved: fleetApproved(found.parsed),
				areas: found.parsed.fields.areas,
				status: found.parsed.fields.status,
				...(deliverable === "report" ? { deliverable: "report" as const } : {}),
				context: found.source,
				dependsOn: (found.parsed.fields.relationships ?? []).filter((relation) => relation.kind === "depends_on").map((relation) => relation.target),
				...(priority === undefined ? {} : { priority }),
				revision: briefRevision(found.parsed),
				sourcePath: path.join(realRoot, found.file),
				workId,
			};
		});
		const publish = publishBoard(root, realRoot, documents);
		return { documents, get, path, publish, realRoot, root, snapshot };
	}),
	methods: ({ root, realRoot, documents, get, publish, path, snapshot }) =>
		BoardGateway.of({
			acknowledgeDecision: acknowledgeDecision(root, realRoot, snapshot),
			complete: Effect.fn("FleetBoard.complete")(function* (workId, sourcePath, nextAction) {
				const work = yield* get(workId);
				if (work.sourcePath !== sourcePath) {
					return;
				}
				const content = completionMarkdown(work.context, nextAction);
				if (content === undefined) {
					return;
				}
				const parsed = boardApi.metadataParse(content);
				if (parsed.fields.id !== workId || parsed.diagnostics.length > 0 || briefRevision(parsed) !== work.revision) {
					return yield* Effect.fail(new BoardFailure({ message: "Completion bookkeeping would change authored Board context or identity." }));
				}
				yield* writeCompletion(root, realRoot, path.relative(realRoot, sourcePath), work.context, content).pipe(
					Effect.mapError((error) => new BoardFailure({ message: error.message })),
				);
			}),
			decision: Effect.fn("FleetBoard.decision")(function* (workId, input, originalContext) {
				const work = originalContext ?? (yield* get(workId));
				const parsed = yield* workMetadata(work);
				const relativeSource = path.relative(realRoot, work.sourcePath);
				if (
					work.workId !== workId
					|| workRevision(work.revision, work.context) !== briefRevision(parsed)
					|| parsed.fields.id !== workId
					|| parsed.diagnostics.length > 0
					|| relativeSource === "."
					|| !Schema.is(RepositoryPath)(relativeSource)
				) {
					return yield* Effect.fail(
						new BoardFailure({ message: "The original Board publication context does not match its identity, revision or source boundary." }),
					);
				}
				return yield* publish(work, input);
			}),
			get,
			readDecision: decisionReading(documents),
			report: publishReport(root, realRoot, documents),
		}),
	requires: [BoardRoot, FileSystem.FileSystem, Path.Path],
});

export function markdownBoard(root: string) {
	return Layer.effect(BoardGateway)(MarkdownBoard).pipe(Layer.provide(MarkdownBoard.layer.pipe(Layer.provide(Layer.succeed(BoardRoot, root)))));
}

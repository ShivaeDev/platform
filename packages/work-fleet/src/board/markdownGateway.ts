import { Context, Effect, FileSystem, Option, Path, Schema } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { Workspace } from "@shivaedev/work-board/server/workspace.ts";
import { acknowledgeDecision } from "#board/acknowledgeDecision.ts";
import { briefRevision } from "#board/briefRevision.ts";
import { closeFinishedDecisions } from "#board/closeFinishedDecisions.ts";
import { completeBoard } from "#board/complete.ts";
import { decisionReading } from "#board/decisionReading.ts";
import { BoardIndex } from "#board/Index.ts";
import { publishBoard } from "#board/publish.ts";
import { publishReport } from "#board/publishReport.ts";
import { workMetadata } from "#board/readPass.ts";
import { readWork } from "#board/readWork.ts";
import { recordDecisionResponse } from "#board/recordDecisionResponse.ts";
import { upgradeDecisionClosure } from "#board/upgradeDecisionClosure.ts";
import { metadataProblem } from "#board/workPolicy.ts";
import { workRevision } from "#board/workRevision.ts";
import { boardSnapshot } from "#board/workspace.ts";
import { BoardFailure, BoardGateway } from "#policy.ts";
import { RepositoryPath } from "#preparation/schema.ts";

export class BoardRoot extends Context.Service<BoardRoot, string>()("@shivaedev/work-fleet/BoardRoot") {}

export const MarkdownBoard = defineService({
	id: "@shivaedev/work-fleet/MarkdownBoard",
	initialize: Effect.gen(function* () {
		const root = yield* BoardRoot;
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const realRoot = yield* fs.realPath(root);
		const workspace = yield* Workspace;
		const sources = boardSnapshot(root, realRoot).pipe(
			Effect.provideService(Workspace, workspace),
			Effect.provideService(FileSystem.FileSystem, fs),
			Effect.provideService(Path.Path, path),
		);
		const snapshot = sources.pipe(
			Effect.tap((current) =>
				upgradeDecisionClosure(root, realRoot, current).pipe(
					Effect.provideService(FileSystem.FileSystem, fs),
					Effect.provideService(Path.Path, path),
					Effect.provideService(Workspace, workspace),
				),
			),
		);
		const documents = snapshot.pipe(Effect.map((current) => current.documents.filter((document) => metadataProblem(document) === undefined)));
		function decisionSnapshot(item: string) {
			return workspace.settings().pipe(
				Effect.flatMap(({ changes }) => changes.refresh ?? Effect.void),
				Effect.andThen(workspace.archived(item).pipe(Effect.mapError((error) => new BoardFailure({ message: error.message })))),
				Effect.provideService(FileSystem.FileSystem, fs),
				Effect.provideService(Path.Path, path),
			);
		}

		function get(workId: string, options?: { readonly fresh?: boolean }) {
			return snapshot.pipe(
				Effect.flatMap((current) => readWork(current, workId, options)),
				Effect.provideService(FileSystem.FileSystem, fs),
				Effect.provideService(Path.Path, path),
				Effect.provideService(Workspace, workspace),
			);
		}
		const publish = publishBoard(root, realRoot, documents);
		function sourceCreatedAt(sourcePath: string) {
			return fs.stat(sourcePath).pipe(
				Effect.map((info) => Option.getOrUndefined(Option.map(info.birthtime, (time) => time.getTime()))),
				Effect.mapError((error) => new BoardFailure({ message: error.message })),
			);
		}
		return { decisionSnapshot, documents, fs, get, path, publish, realRoot, root, snapshot, sourceCreatedAt, sources, workspace };
	}),
	methods: ({ root, realRoot, decisionSnapshot, documents, get, publish, path, snapshot, sources, sourceCreatedAt, workspace, fs }) => ({
		...BoardGateway.of({
			acknowledgeDecision: (input) =>
				acknowledgeDecision(
					root,
					realRoot,
					snapshot,
					decisionSnapshot,
				)(input).pipe(
					Effect.provideService(FileSystem.FileSystem, fs),
					Effect.provideService(Path.Path, path),
					Effect.provideService(Workspace, workspace),
				),
			closeFinishedDecisions: (options) =>
				closeFinishedDecisions(
					realRoot,
					sources,
				)(options).pipe(
					Effect.provideService(FileSystem.FileSystem, fs),
					Effect.provideService(Path.Path, path),
					Effect.provideService(Workspace, workspace),
				),
			complete: Effect.fn("FleetBoard.complete")(function* (workId, sourcePath, nextAction) {
				const expected = yield* get(workId);
				const work = yield* get(workId, { fresh: true });
				if (work.sourcePath !== sourcePath || work.revision !== expected.revision) {
					return;
				}
				yield* completeBoard(realRoot, work, nextAction).pipe(Effect.provideService(Workspace, workspace), Effect.provideService(Path.Path, path));
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
			readDecision: decisionReading(snapshot, decisionSnapshot),
			report: publishReport(root, realRoot, documents),
			respond: recordDecisionResponse(root, realRoot, snapshot),
			sourceCreatedAt,
		}),
	}),
	requires: [BoardRoot, FileSystem.FileSystem, Path.Path, Workspace, BoardIndex],
});

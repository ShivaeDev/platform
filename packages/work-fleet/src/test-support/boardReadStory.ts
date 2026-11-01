import { join } from "node:path";
import { queryObjects } from "node:v8";
import { NodeServices } from "@effect/platform-node";
import { Context, Deferred, Effect, Fiber, FileSystem, Layer } from "effect";
import { vi } from "vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { board as metadata } from "@shivaedev/work-board/server/integration/board.ts";
import { briefRevision } from "#board/briefRevision.ts";
import { boardSnapshot } from "#board/documents.ts";
import { BoardSnapshot, publishAfterBoardPass, withBoardReadPass, workMetadata } from "#board/readPass.ts";
import { statusMarkdown } from "#board/statusMarkdown.ts";
import { workRevision } from "#board/workRevision.ts";
import { writeStatus } from "#board/writeStatus.ts";
import { approvedWorkIds } from "#host/admission.ts";
import { resolveHost } from "#host/config.ts";
import { BoardGateway, type BoardWork } from "#policy.ts";
import type { SessionObservation } from "#session/schema.ts";
import { boardReads } from "#test/boardReads.ts";
import { refusal } from "#test/refusal.ts";
import { reportAttachmentVerbs } from "#test/reportAttachmentVerbs.ts";
import { statusRecord } from "#test/status.ts";
import { syntheticDatabase } from "#test/syntheticDatabase.ts";

export const boardReadStory = storyKit({
	clock: "live",
	*create() {
		const fixture = yield* boardReads(0);
		const board = Context.get(yield* Layer.build(fixture.board), BoardGateway);
		const publications: string[] = [];
		return { board, fixture, fs: yield* FileSystem.FileSystem, parses: (): number => 0, publications };
	},
	layer: NodeServices.layer,
	name: "Board folder reads",
	stages: ["files"],
	verbs: (state, story) => {
		const { fixture, fs } = state;
		const publish = writeStatus(fixture.root, fixture.root, [statusRecord("item.0")]).pipe(
			Effect.orDie,
			Effect.tap(() =>
				Effect.sync(() => {
					state.publications.push("fleet/status.md");
				}),
			),
		);
		const approvedIds = approvedWorkIds(resolveHost(fixture.root, { database: syntheticDatabase, provider: "local" })).pipe(
			Effect.provide(fixture.services),
		);
		function read(id: string, options?: { readonly fresh?: boolean }) {
			return Effect.suspend(() => {
				story.tell(`read Board work ${id}${options?.fresh ? " freshly" : ""}`);
				return state.board.get(id, options);
			});
		}
		return {
			...reportAttachmentVerbs(fixture),
			approvalOf: (id: string, options?: { readonly fresh?: boolean }) =>
				read(id, options).pipe(Effect.map((work) => (work.approved ? "approved" : "held"))),
			approvedIds: () => {
				story.tell("list approved Board work");
				return approvedIds;
			},
			approvedIdsFailure: () => refusal(approvedIds),
			board: state.board,
			decide: (id: string, decision: Parameters<typeof state.board.decision>[1]) => {
				story.tell(`publish decision ${decision.id} for ${id}`);
				return state.board.decision(id, decision);
			},
			decisionState: (decision: Parameters<typeof state.board.readDecision>[0]) =>
				state.board.readDecision(decision).pipe(Effect.map((reading) => reading._tag.toLowerCase())),
			deferStatus: () => {
				story.tell("defer the generated status publication");
				return publishAfterBoardPass(publish);
			},
			duringOnePass: <A, E, R>(effect: Effect.Effect<A, E, R>) => {
				story.tell("start a Board read pass");
				return withBoardReadPass(effect).pipe(Effect.provide(fixture.services));
			},
			edit: (file: string, id: string, approved: boolean, body?: string) => {
				story.tell(`edit Board file ${file} as ${approved ? "approved" : "held"}`);
				return fixture.write(file, fixture.source(id, approved, body));
			},
			holdPassAfter: Effect.fn("Story.holdPassAfter")(function* <A, E>(effect: Effect.Effect<A, E>) {
				story.tell("a read pass finishes while a fiber it started waits to read again");
				const release = yield* Deferred.make<void>();
				const pending = yield* withBoardReadPass(Deferred.await(release).pipe(Effect.andThen(effect), Effect.forkScoped));
				return {
					resume: () => {
						story.tell("the waiting fiber reads after its pass ended");
						return Deferred.succeed(release, undefined).pipe(Effect.andThen(Fiber.join(pending)));
					},
				};
			}),
			holdScanReading: Effect.fn("Story.holdScanReading")(function* (id: string, scope: "in a pass" | "without a pass") {
				const pause = yield* fixture.pauseReads;
				story.tell(`a scan reading ${id} ${scope} pauses after reading its first file`);
				const first = yield* (scope === "in a pass" ? withBoardReadPass(state.board.get(id)) : state.board.get(id)).pipe(Effect.forkScoped);
				yield* pause.entered;
				return {
					release: () => {
						story.tell("the paused scan continues");
						return pause.release;
					},
					result: () => Fiber.join(first),
				};
			}),
			listingFailure: () => refusal(boardSnapshot(fixture.root, fixture.root).pipe(Effect.provide(fixture.services))),
			makeReadable: () => {
				story.tell("every Board file becomes readable again");
				fixture.unreadable.clear();
			},
			makeUnreadable: (file: string) => {
				story.tell(`${file === "." ? "the Board folder" : file} becomes unreadable`);
				fixture.unreadable.add(file);
			},
			parses: () => Effect.sync(() => state.parses()),
			publicationCount: () => state.publications.length,
			publications: () => Effect.sync(() => [...state.publications]),
			publishedStatus: () =>
				Effect.gen(function* () {
					const path = `${fixture.root}/fleet/status.md`;
					return (yield* fs.exists(path)) ? yield* fs.readFileString(path) : undefined;
				}),
			read,
			readFiles: () => Effect.sync(() => fixture.readFiles()),
			readInPass: (id: string, options?: { readonly fresh?: boolean }) => {
				story.tell(`read Board work ${id} in a new pass`);
				return withBoardReadPass(state.board.get(id, options)).pipe(Effect.provide(fixture.services));
			},
			readsPerFile: () => Effect.sync(() => [...fixture.reads.values()]),
			refusalOf: (id: string, options?: { readonly fresh?: boolean }) => refusal(read(id, options)),
			remove: (file: string) => {
				story.tell(`remove Board file ${file}`);
				return fixture.remove(file);
			},
			report: (work: BoardWork, observation: SessionObservation) => {
				story.tell(`publish a report for ${work.workId}`);
				return state.board.report(work, observation);
			},
			revisionMatchesMetadata: (work: BoardWork) => workMetadata(work).pipe(Effect.map((parsed) => work.revision === briefRevision(parsed))),
			root: fixture.root,
			savedRevision: (revision: string, context?: string) => Effect.sync(() => workRevision(revision, context)),
			scannedFolders: () => Effect.sync(() => fixture.scannedFolders()),
			scans: () => Effect.sync(() => fixture.scans()),
			startReaders: Effect.fn("Story.startReaders")(function* (count: number, id: string, scope: "in passes and without" | "in fresh passes") {
				story.tell(`${count} readers ask for ${id} ${scope}`);
				const readers = yield* Effect.all(
					Array.from({ length: count }, (_, index) => {
						if (scope === "in fresh passes") {
							return withBoardReadPass(state.board.get(id), { fresh: true });
						}
						return index % 2 === 0 ? withBoardReadPass(state.board.get(id)) : state.board.get(id);
					}),
					{ concurrency: "unbounded" },
				).pipe(Effect.forkScoped);
				yield* Effect.yieldNow;
				return { results: () => Fiber.join(readers) };
			}),
			storedSource: (file: string) => {
				story.tell(`read the stored Board source ${file}`);
				return fs.readFileString(join(fixture.root, file)).pipe(
					Effect.catchIf(
						(error) => error.reason._tag === "NotFound",
						() => Effect.succeed("missing"),
					),
				);
			},
			write: (file: string, id: string) => {
				story.tell(`write Board file ${file} with ${id}`);
				return fixture.write(file, fixture.source(id));
			},
			writeGeneratedStatus: () => {
				story.tell("Fleet writes its generated status into fleet/status.md");
				return fs
					.makeDirectory(`${fixture.root}/fleet`, { recursive: true })
					.pipe(Effect.andThen(fixture.write("fleet/status.md", statusMarkdown([]))));
			},
			writeSource: (file: string, content: string) => {
				story.tell(`write Board file ${file}`);
				return fixture.write(file, content);
			},
		};
	},
});

export function hasBoardItems(count: number) {
	return boardReadStory.trait("files", `the Board folder contains ${count} approved items`, function* ({ fixture }) {
		for (let index = 0; index < count; index += 1) {
			yield* fixture.write(`${index}.md`, fixture.source(`item.${index}`));
		}
	});
}

export const countedParses = boardReadStory.trait("files", "Board metadata parses are counted", function* (state) {
	const parse = vi.spyOn(metadata, "metadataParse");
	yield* Effect.addFinalizer(() => Effect.sync(() => parse.mockRestore()));
	state.parses = () => parse.mock.calls.length;
});

export const retainedBoardSnapshots = Effect.promise(() => new Promise<void>((resolve) => setImmediate(resolve))).pipe(
	Effect.andThen(Effect.sync(() => queryObjects(BoardSnapshot, { format: "count" }))),
);

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Context, Effect, FileSystem, Layer, Ref } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { boardOf } from "@shivaedev/work-board/server/render/board.ts";
import { boardDocuments } from "#board/documents.ts";
import { markdownBoard } from "#board/markdown.ts";
import { publishReportAttachments } from "#board/publishReportAttachments.ts";
import { reportFileName } from "#board/reportLinks.ts";
import { reportPayload } from "#board/reportPayload.ts";
import { writeHealth } from "#board/writeHealth.ts";
import { writeStatus } from "#board/writeStatus.ts";
import { Health } from "#engine/health.ts";
import { exposeFailure } from "#exposeFailure.ts";
import { healthLayer } from "#host/healthLayer.ts";
import type { BoardWork } from "#policy.ts";
import { BoardGateway } from "#policy.ts";
import type { SessionObservation } from "#session/schema.ts";
import { completionFolder } from "#test/completionFolder.ts";
import { healthFolder } from "#test/health.ts";
import { refusal } from "#test/refusal.ts";
import { reportBoard } from "#test/report.ts";
import { reportPublicationVerbs } from "#test/reportPublicationVerbs.ts";
import { statusFolder } from "#test/status.ts";

export const boardFileStory = storyKit({
	clock: "live",
	*create() {
		return {
			completion: yield* completionFolder,
			health: yield* healthFolder(),
			reportRoot: yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped(),
			status: yield* statusFolder(),
		};
	},
	layer: NodeServices.layer,
	name: "Board publication files",
	stages: ["boundary"],
	verbs: (state, story) => {
		const fs = state.completion.fs;
		const reportVerbs = reportPublicationVerbs(state.reportRoot, story.tell);
		function identity(stat: { readonly ino: number; readonly mtimeMs: number }) {
			return { inode: stat.ino, modified: stat.mtimeMs };
		}
		return {
			completion: {
				...state.completion,
				complete: (id: string, file: string, summary: string) => {
					story.tell(`complete Board work ${id} from ${file.replace(state.completion.root, "")}`);
					return refusal(completeWork(state.completion.root, id, file, summary));
				},
				taskSource: () => fs.readFileString(`${state.completion.root}/tasks/one.md`),
				writeTask: (content: string) => {
					story.tell("a person rewrites tasks/one.md");
					return fs.writeFileString(`${state.completion.root}/tasks/one.md`, content);
				},
			},
			files: {
				attachment: (id: string, name: string) => Effect.sync(() => readFileSync(join(state.reportRoot, "responses", `${id}.attachments`, name))),
				attachmentNames: (id: string) => Effect.sync(() => readdirSync(join(state.reportRoot, "responses", `${id}.attachments`))),
				documents: () => {
					story.tell("read the Board source index");
					return boardDocuments(state.reportRoot, state.reportRoot);
				},
				evidence: (report: { readonly itemId: string; readonly sourcePath: string }, kind: "attachment" | "report"): Effect.Effect<unknown> =>
					kind === "attachment"
						? Effect.sync(() => readFileSync(join(state.reportRoot, "responses", `${report.itemId}.attachments`, reportFileName("evidence.txt"))))
						: Effect.sync(() => readFileSync(join(state.reportRoot, report.sourcePath), "utf8")),
				publishAttachments: (id: string, files: Parameters<typeof publishReportAttachments>[2]) => {
					story.tell(`publish report attachments ${files.map(({ path }) => path).join(", ")}`);
					return publishReportAttachments(state.reportRoot, id, files);
				},
				readReport: (work: BoardWork, observation: SessionObservation) => {
					story.tell("decode the persisted report payload");
					return refusal(exposeFailure(reportPayload(state.reportRoot, work, observation).read));
				},
				retainReport: (work: BoardWork, observation: SessionObservation, output: string) => {
					story.tell("retain the completed report for recovery");
					return reportPayload(state.reportRoot, work, observation).save({ files: [], output });
				},
				root: state.reportRoot,
				savedReport: (work: BoardWork, observation: SessionObservation) => reportPayload(state.reportRoot, work, observation).read,
				source: (path: string) => Effect.sync(() => readFileSync(join(state.reportRoot, path), "utf8")),
				work: (id: string) =>
					Effect.gen(function* () {
						story.tell(`read report work ${id}`);
						const board = Context.get(yield* Layer.build(markdownBoard(state.reportRoot)), BoardGateway);
						return yield* board.get(id);
					}),
				writePayload: (id: string, content: string) => {
					story.tell(`an earlier Fleet left report payload ${id}`);
					return fs
						.makeDirectory(`${state.reportRoot}/.fleet-reports`, { recursive: true })
						.pipe(Effect.andThen(fs.writeFileString(`${state.reportRoot}/.fleet-reports/${id}.json`, content)));
				},
			},
			health: {
				...state.health,
				files: () => Effect.sync(() => state.health.files()),
				identity: () => Effect.sync(() => identity(state.health.stat())),
				outsideSource: () => Effect.sync(() => state.health.outside()),
				publish: (snapshot: Parameters<typeof writeHealth>[2]) => {
					story.tell(`publish Fleet health with ${snapshot.running} running`);
					return writeHealth(state.health.root, state.health.root, snapshot);
				},
				published: () => Effect.sync(() => state.health.read()),
				publishedSource: () => Effect.sync(() => state.health.source()),
				readWhileReplacing: Effect.fn("Story.readWhileReplacing")(function* (snapshot: Parameters<typeof writeHealth>[2], replacements: number) {
					story.tell(`a reader reads health while Fleet replaces it ${replacements} times`);
					const versions: number[] = [];
					for (let running = 0; running < replacements; running += 1) {
						const writing = Effect.runPromise(
							writeHealth(state.health.root, state.health.root, { ...snapshot, running }).pipe(Effect.provideService(FileSystem.FileSystem, fs)),
						);
						versions.push(state.health.read().version);
						yield* Effect.promise(() => writing);
					}
					return versions;
				}),
				restore: () => {
					story.tell("reload host health after restart");
					return Effect.flatMap(Health, Ref.get).pipe(Effect.provide(healthLayer(state.health.root)));
				},
				writeLegacy: (snapshot: object) => {
					story.tell("an earlier Fleet left a version 1 health snapshot");
					return fs.writeFileString(`${state.health.root}/fleet/health.json`, JSON.stringify(snapshot));
				},
			},
			report: {
				...reportVerbs,
				collections: () => Effect.sync(() => reportVerbs.collections()),
				publish: (...args: Parameters<typeof reportVerbs.publish>) => refusal(reportVerbs.publish(...args)),
			},
			status: {
				...state.status,
				card: (column: string) => Effect.sync(() => boardOf(state.status.read()).sections.find(({ title }) => title === column)?.items[0]),
				identity: () => Effect.sync(() => identity(state.status.stat())),
				outsideSource: () => Effect.sync(() => state.status.outsideSource()),
				publish: (records: Parameters<typeof writeStatus>[2]) => {
					story.tell(`publish Fleet status for ${records.map(({ workId }) => workId).join(", ")}`);
					return refusal(writeStatus(state.status.root, state.status.root, records));
				},
				published: () => Effect.sync(() => state.status.read()),
				sections: () => Effect.sync(() => boardOf(state.status.read()).sections.map(({ items, title }) => ({ cards: items, title }))),
				taskSource: () => Effect.sync(() => state.status.taskSource()),
			},
		};
	},
});
const completeWork = Effect.fn("Story.completeWork")(function* (root: string, id: string, file: string, summary: string) {
	const board = Context.get(yield* Layer.build(markdownBoard(root)), BoardGateway);
	if (board.complete === undefined) {
		return yield* Effect.die("Board completion capability is missing");
	}
	return yield* board.complete(id, file, summary);
});
export function statusBoundary(boundary: Parameters<typeof statusFolder>[0]) {
	return boardFileStory.trait("boundary", `status publication meets ${boundary}`, function* (state) {
		state.status = yield* statusFolder(boundary);
	});
}
export function healthBoundary(boundary: Parameters<typeof healthFolder>[0]) {
	return boardFileStory.trait("boundary", `health publication meets ${boundary}`, function* (state) {
		state.health = yield* healthFolder(boundary);
	});
}

export const withReportWork = boardFileStory.trait("boundary", "the Board contains report work", function* (state) {
	state.reportRoot = yield* reportBoard;
});

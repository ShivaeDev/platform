import { NodeServices } from "@effect/platform-node";
import { Context, Effect, FileSystem, Layer, Ref } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { boardDocuments } from "#board/documents.ts";
import { markdownBoard } from "#board/markdown.ts";
import { reportFiles } from "#board/reportFiles.ts";
import { reportPayload } from "#board/reportPayload.ts";
import { reportPayloadFile } from "#board/reportPayloadFile.ts";
import { writeCompletion } from "#board/writeCompletion.ts";
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
import { linkedReportBoundary } from "#test/linkedReportBoundary.ts";
import { linkedReportPayload } from "#test/linkedReportPayload.ts";
import { reportBoard } from "#test/report.ts";
import { reportPublicationVerbs } from "#test/reportPublicationVerbs.ts";
import { statusFolder } from "#test/status.ts";

export const boardFileStory = storyKit({
	clock: "live",
	*create() {
		return {
			completion: yield* completionFolder,
			externalFile: "",
			health: yield* healthFolder(),
			outside: "",
			reportRoot: yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped(),
			status: yield* statusFolder(),
		};
	},
	layer: NodeServices.layer,
	name: "Board publication files",
	stages: ["boundary"],
	verbs: (state, story) => ({
		completion: {
			...state.completion,
			complete: (id: string, file: string, summary: string) =>
				Effect.gen(function* () {
					story.tell(`complete Board work ${id}`);
					const board = Context.get(yield* Layer.build(markdownBoard(state.completion.root)), BoardGateway);
					if (board.complete === undefined) {
						return yield* Effect.die("Board completion capability is missing");
					}
					return yield* board.complete(id, file, summary);
				}),
			publish: (originalRoot: string, file: string, source: string, content: string) => {
				story.tell(`publish completion at ${file}`);
				return writeCompletion(state.completion.root, originalRoot, file, source, content);
			},
		},
		files: {
			documents: () => {
				story.tell("read the Board source index");
				return boardDocuments(state.reportRoot, state.reportRoot);
			},
			externalFile: state.externalFile,
			outside: state.outside,
			payload: (id: string, content?: string) => {
				story.tell(`read or retain report payload ${id}`);
				return reportPayloadFile(state.reportRoot, id, content);
			},
			publishAttachments: (id: string, files: Parameters<typeof reportFiles>[2]) => {
				story.tell("publish report attachment bytes");
				return reportFiles(state.reportRoot, id, files);
			},
			readReport: (work: BoardWork, observation: SessionObservation) => {
				story.tell("decode the persisted report payload");
				return exposeFailure(reportPayload(state.reportRoot, work, observation).read);
			},
			root: state.reportRoot,
			work: (id: string) =>
				Effect.gen(function* () {
					story.tell(`read report work ${id}`);
					const board = Context.get(yield* Layer.build(markdownBoard(state.reportRoot)), BoardGateway);
					return yield* board.get(id);
				}),
		},
		health: {
			...state.health,
			publish: (snapshot: Parameters<typeof writeHealth>[2]) => {
				story.tell("publish Fleet health");
				return writeHealth(state.health.root, state.health.root, snapshot);
			},
			restore: () => {
				story.tell("reload host health after restart");
				return Effect.flatMap(Health, Ref.get).pipe(Effect.provide(healthLayer(state.health.root)));
			},
		},
		report: reportPublicationVerbs(state.reportRoot, story.tell),
		status: {
			...state.status,
			publish: (records: Parameters<typeof writeStatus>[2]) => {
				story.tell("publish Fleet status");
				return writeStatus(state.status.root, state.status.root, records);
			},
		},
	}),
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

export function attachmentBoundary(boundary: string, id: string, name: string) {
	return boardFileStory.trait("boundary", `report attachments meet a linked ${boundary}`, function* (state) {
		const fixture = yield* linkedReportBoundary(boundary, id, name);
		state.reportRoot = fixture.workspace;
		state.outside = fixture.outside;
	});
}
export function payloadBoundary(boundary: string, id: string) {
	return boardFileStory.trait("boundary", `report payload meets a linked ${boundary}`, function* (state) {
		const fixture = yield* linkedReportPayload(boundary, id);
		state.reportRoot = fixture.workspace;
		state.externalFile = fixture.externalFile;
	});
}

export const withReportWork = boardFileStory.trait("boundary", "the Board contains report work", function* (state) {
	state.reportRoot = yield* reportBoard;
});

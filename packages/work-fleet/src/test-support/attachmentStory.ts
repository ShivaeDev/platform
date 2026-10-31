import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { reportAttachmentFiles } from "#host/reportAttachmentFiles.ts";
import { reportFileChanges } from "#host/reportFileChanges.ts";
import { codexReportAttachments } from "#providers/codexReportAttachments.ts";
import { connect, request } from "#providers/codexRpc.ts";
import { codexTurns } from "#providers/codexTurns.ts";
import { codexServer, type Handshake, type WireRequest } from "#test/codex.ts";
import { authFolder, FUTURE_EXPIRY, syntheticToken } from "#test/codexCloud.ts";
import { refusal } from "#test/refusal.ts";
import { oversizedAttachments, reconstructedAttachment } from "#test/reportAttachmentSafety.ts";
import { scripted, type WireScript, wireLog } from "#test/wireScript.ts";

export const attachmentStory = storyKit({
	clock: "live",
	*create() {
		const requests: WireRequest[] = [];
		const handshakes: Handshake[] = [];
		const serverState = { reply: (_request: WireRequest): unknown => ({}) };
		const fixture = yield* codexServer((input) => {
			requests.push(input);
			return input.method === "initialized" ? undefined : serverState.reply(input);
		}, handshakes);
		const token = syntheticToken("report", FUTURE_EXPIRY);
		const authFile = yield* authFolder(token);
		const connection = yield* connect({ url: new URL(fixture.endpoint) }, 1000);
		const { readItems } = codexTurns((method, params, mutation) => request(connection, 1000, method, params, mutation));
		const scratch: { value?: { folder: string; names: readonly string[] } } = {};
		return {
			handshakes,
			read: codexReportAttachments({ authFile, endpoint: fixture.endpoint }, 5000),
			readItems,
			requests,
			scratch,
			serverState,
		};
	},
	layer: NodeServices.layer,
	name: "Codex report downloads",
	stages: ["scratch"],
	verbs: (state, story) => ({
		...wireLog(() => state.requests),
		answers: (script: WireScript) =>
			Effect.sync(() => {
				story.tell("the fake Codex server supplies report history");
				state.serverState.reply = scripted(script);
			}),
		download: (observation: Parameters<typeof state.read>[0]) => {
			story.tell(`download the attachments of turn ${observation.receipt.turnId}`);
			return state.read(observation).pipe(
				Effect.map(({ files, unavailable }) => ({
					files: files.map(({ bytes, path }) => ({ path, text: new TextDecoder().decode(bytes) })),
					unavailable,
				})),
			);
		},
		files: () => {
			if (state.scratch.value === undefined) {
				throw new Error("Prepare reconstructed files before reading them");
			}
			story.tell("read regular attachment files inside the scratch directory");
			return reportAttachmentFiles(state.scratch.value.folder, state.scratch.value.names);
		},
		offeredProtocols: () => Effect.sync(() => state.handshakes.flatMap(({ protocols }) => protocols)),
		readItems: (receipt: Parameters<typeof state.readItems>[0], limit?: number) => {
			story.tell(`read the items of turn ${receipt.turnId}${limit === undefined ? "" : ` within ${limit} bytes`}`);
			return refusal(state.readItems(receipt, limit));
		},
		reconstruct: (items: Parameters<typeof reportFileChanges>[0], output: string) => {
			story.tell("reconstruct the report turn's file edits");
			return reportFileChanges(items, output);
		},
	}),
});

export function reconstructed(kind: Parameters<typeof reconstructedAttachment>[0]) {
	return attachmentStory.trait("scratch", `the scratch directory contains a reconstructed ${kind}`, function* (state) {
		const { folder, name } = yield* reconstructedAttachment(kind);
		state.scratch.value = { folder, names: [name] };
	});
}
export const oversizedFiles = attachmentStory.trait("scratch", "the reconstructed attachments exceed the aggregate limit", function* (state) {
	state.scratch.value = { folder: yield* oversizedAttachments(), names: ["first", "second"] };
});

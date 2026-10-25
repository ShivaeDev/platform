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
import { oversizedAttachments, reconstructedAttachment } from "#test/reportAttachmentSafety.ts";

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
		files: () => {
			if (state.scratch.value === undefined) {
				throw new Error("Prepare reconstructed files before reading them");
			}
			story.tell("read regular attachment files inside the scratch directory");
			return reportAttachmentFiles(state.scratch.value.folder, state.scratch.value.names);
		},
		protocols: () => state.handshakes.map((handshake) => handshake.protocols),
		read: (...args: Parameters<typeof state.read>) => {
			story.tell("download the report turn's attachments");
			return state.read(...args);
		},
		readItems: (...args: Parameters<typeof state.readItems>) => {
			story.tell("read the turn's paginated items");
			return state.readItems(...args);
		},
		reconstruct: (items: Parameters<typeof reportFileChanges>[0], output: string) => {
			story.tell("reconstruct the report turn's file edits");
			return reportFileChanges(items, output);
		},
		replyWith: (reply: (request: WireRequest) => unknown) =>
			Effect.sync(() => {
				story.tell("the fake Codex server supplies report history");
				state.serverState.reply = reply;
			}),
		requests: () => state.requests,
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

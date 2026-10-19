import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { codexReportAttachments } from "#providers/codexReportAttachments.ts";
import { connect, request } from "#providers/codexRpc.ts";
import { codexTurns } from "#providers/codexTurns.ts";
import { codexServer, type Handshake, type WireRequest } from "#test/codex.ts";
import { authFolder, FUTURE_EXPIRY, syntheticToken } from "#test/codexCloud.ts";

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
		return { handshakes, read: codexReportAttachments({ authFile, endpoint: fixture.endpoint }, 5000), readItems, requests, serverState };
	},
	layer: NodeServices.layer,
	name: "Codex report downloads",
	stages: [],
	verbs: (state, story) => ({
		protocols: () => state.handshakes.map((handshake) => handshake.protocols),
		read: (...args: Parameters<typeof state.read>) => {
			story.tell("download the report turn's attachments");
			return state.read(...args);
		},
		readItems: (...args: Parameters<typeof state.readItems>) => {
			story.tell("read the turn's paginated items");
			return state.readItems(...args);
		},
		replyWith: (reply: (request: WireRequest) => unknown) =>
			Effect.sync(() => {
				story.tell("the fake Codex server supplies report history");
				state.serverState.reply = reply;
			}),
		requests: () => state.requests,
	}),
});

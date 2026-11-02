import { Effect, Layer } from "effect";
import { McpClient, McpProtocol } from "effect/ai";
import { FetchHttpClient } from "effect/http";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { call } from "#test/requests/client.ts";
import { startServer } from "#test/requests/startServer.ts";
import { audiences } from "./tools.ts";

export const core = storyKit({
	clock: "live",
	create: () => startServer(Layer.mergeAll(Layer.empty, ...audiences.map(({ tools }) => tools))),
	name: "MCP with an application session policy",
	stages: [],
	verbs: (url, story) => ({
		identify: (origin?: string) =>
			Effect.gen(function* () {
				story.tell(`alice calls whoami with ${origin ?? "no Origin"}`);
				const client = yield* McpClient.make({ name: "Custom policy client", version: "1" }).pipe(
					Effect.provideServiceEffect(
						McpClient.Transport,
						McpClient.http({
							headers: { "x-story-caller": "alice", ...(origin === undefined ? {} : { origin }) },
							protocol: McpProtocol.v2026_07_28,
							url,
						}),
					),
					Effect.provide(FetchHttpClient.layer),
				);
				return yield* call(client, "whoami");
			}).pipe(Effect.catchReason("McpClientError", "HttpError", (reason) => Effect.succeed(`HTTP ${reason.status}`))),
	}),
});

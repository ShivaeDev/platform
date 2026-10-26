import { type Context, Effect, Layer, Option, Schema, Stream } from "effect";
import { FetchHttpClient } from "effect/http";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { GitHub, list, read, write } from "#GitHub.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { GitHubToken } from "#GitHubToken.ts";

const Result = Schema.Struct({ number: Schema.Number });

function responseVerbs(context: Context.Context<Context.Service.Identifier<typeof GitHub>>) {
	const verbs = {
		list: (limit?: number) => list("/pages", Result, limit).pipe(Stream.runCollect, Effect.provide(context)),
		read: (limit?: number) => read("/response", Result, limit).pipe(Effect.provide(context)),
		write: (limit?: number) => write("POST", "/response", {}, Result, limit).pipe(Effect.provide(context)),
	};
	return (operation: keyof typeof verbs, limit?: number) =>
		Effect.gen(function* () {
			return yield* verbs[operation](limit);
		});
}

export const jsonResponses = storyKit({
	*create() {
		const state = { invalid: false, size: 3 * 1024 * 1024, unfinished: false };
		function reply(array: boolean) {
			const empty = JSON.stringify({ number: state.invalid ? "one" : 1, padding: "" });
			const item = JSON.stringify({ number: state.invalid ? "one" : 1, padding: "x".repeat(state.size - empty.length - (array ? 2 : 0)) });
			const body = array ? `[${item}]` : item;
			return {
				chunks: (async function* () {
					for (let offset = 0; offset < body.length; offset += 64 * 1024) {
						yield body.slice(offset, offset + 64 * 1024);
					}
					if (state.unfinished) {
						await Promise.withResolvers<void>().promise;
					}
				})(),
			};
		}
		const server = yield* fakeHttpService({
			routes: {
				pages: { path: "/pages", reply: () => reply(true) },
				read: { path: "/response", reply: () => reply(false) },
				write: { method: "POST", path: "/response", reply: () => reply(false) },
			},
		});
		function client(config: Context.Service.Shape<typeof GitHubConfig>) {
			return Layer.build(
				GitHub.layer.pipe(
					Layer.provide(FetchHttpClient.layer),
					Layer.provide(Layer.succeed(GitHubToken)(Option.none())),
					Layer.provide(Layer.succeed(GitHubConfig)(config)),
				),
			);
		}
		return {
			defaultContext: yield* client({ apiUrl: server.url }),
			raisedContext: yield* client({ apiUrl: server.url, responseByteLimit: 16 * 1024 * 1024 }),
			server,
			state,
		};
	},
	name: "GitHub JSON responses",
	stages: ["github"],
	verbs: ({ defaultContext, raisedContext, server }, story) => {
		server.narrate(story.tell);
		return { defaultClient: responseVerbs(defaultContext), raisedClient: responseVerbs(raisedContext) };
	},
});

export const seventeenMiB = jsonResponses.trait("github", "GitHub sends a 17 MiB response", ({ state }) => {
	state.size = 17 * 1024 * 1024;
});

export const unfinishedResponse = jsonResponses.trait("github", "GitHub leaves the chunked response open after sending its JSON", ({ state }) => {
	state.unfinished = true;
});

export const invalidResponse = jsonResponses.trait("github", "GitHub sends a string instead of a number", ({ state }) => {
	state.invalid = true;
});

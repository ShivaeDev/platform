import { type Context, Effect, Layer, Option, Schema, Stream } from "effect";
import { FetchHttpClient } from "effect/http";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { GitHub, list, read, write } from "#GitHub.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { GitHubToken } from "#GitHubToken.ts";
import { answered } from "./outcome.ts";

const MEBIBYTE = 1024 * 1024;

const Result = Schema.Struct({ number: Schema.Number });

export type Operation = "read" | "list" | "write";

function responseVerbs(name: string, context: Context.Context<Context.Service.Identifier<typeof GitHub>>, tell: (line: string) => void) {
	const operations = {
		list: (limit?: number) => list("/pages", Result, limit).pipe(Stream.runCollect, Effect.provide(context)),
		read: (limit?: number) => read("/response", Result, limit).pipe(Effect.provide(context)),
		write: (limit?: number) => write("POST", "/response", {}, Result, limit).pipe(Effect.provide(context)),
	};
	return (operation: Operation, requestCap?: number): Effect.Effect<unknown> =>
		Effect.suspend(() => {
			tell(`${name} ${operation}s${requestCap === undefined ? "" : ` with a ${requestCap / MEBIBYTE} MiB request cap`}`);
			return answered<unknown, unknown, never>(operations[operation](requestCap));
		});
}

export const jsonResponses = storyKit({
	*create() {
		const state = { invalid: false, size: 3 * MEBIBYTE, unfinished: false };
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
			raisedContext: yield* client({ apiUrl: server.url, responseByteLimit: 16 * MEBIBYTE }),
			server,
			state,
		};
	},
	name: "GitHub JSON responses",
	stages: ["github"],
	verbs: ({ defaultContext, raisedContext, server }, story) => {
		server.narrate(story.tell);
		return {
			defaultClient: responseVerbs("the client with the default cap", defaultContext, story.tell),
			raisedClient: responseVerbs("the client with a 16 MiB cap", raisedContext, story.tell),
		};
	},
});

export const seventeenMiB = jsonResponses.trait("github", "GitHub sends a 17 MiB response", ({ state }) => {
	state.size = 17 * MEBIBYTE;
});

export const unfinishedResponse = jsonResponses.trait("github", "GitHub leaves the chunked response open after sending its JSON", ({ state }) => {
	state.unfinished = true;
});

export const invalidResponse = jsonResponses.trait("github", 'GitHub writes the number as the text "one"', ({ state }) => {
	state.invalid = true;
});

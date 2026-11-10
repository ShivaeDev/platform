import { Clock, Effect, FileSystem } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { type FakeHttpReply, type FakeHttpRequest, fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import type { Received } from "#test/githubModel.ts";
import { githubReplies } from "#test/githubReplies.ts";
import { makeGitHubState } from "#test/githubState.ts";
import { roundSignals } from "#test/roundSignals.ts";

export const fakeGitHub = Effect.gen(function* () {
	const clock = yield* Clock.Clock;
	const fs = yield* FileSystem.FileSystem;
	const directory = yield* fs.makeTempDirectoryScoped({ prefix: "pr-watch-" });
	const state = makeGitHubState();
	const replyTo = githubReplies(state);
	const requests: Received[] = [];
	function answer(request: FakeHttpRequest): FakeHttpReply {
		const text = request.body.toString();
		const body = text === "" ? undefined : JSON.parse(text);
		const reply = replyTo(request.path, body);
		const etag = `"${JSON.stringify([reply.body, reply.headers?.link])
			.replaceAll('"', "")
			.replaceAll(/[^\x20-\x7e]/gu, "")}"`;
		const unchanged = reply.status === undefined && request.headers["if-none-match"] === etag;
		const status = reply.status ?? (unchanged ? HttpStatus.fromLiteral("NotModified") : HttpStatus.fromLiteral("OK"));
		requests.push({
			at: clock.currentTimeMillisUnsafe(),
			authorization: request.headers.authorization,
			body,
			method: request.method,
			path: request.path,
			status,
		});
		return { body: unchanged ? undefined : reply.body, headers: { etag, ...reply.headers }, status };
	}
	const server = yield* fakeHttpService({
		routes: {
			graphql: { method: "POST", path: "/:path*", reply: answer },
			rest: { path: "/:path*", reply: answer },
		},
	});
	return {
		...state,
		...roundSignals(),
		apiUrl: server.url,
		directory,
		holdRequest: (path: string) => server.hold("rest", { once: true, params: { path: new URL(path, server.url).pathname.slice(1) } }),
		requests,
	};
});

export type FakeGitHub = Effect.Success<typeof fakeGitHub>;

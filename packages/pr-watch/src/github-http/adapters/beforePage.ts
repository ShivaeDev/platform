import { type Context, Effect } from "effect";
import type { GitHub } from "@shivaedev/github/github/service.ts";
import { beforeRequest } from "#github-http/beforeRequest.ts";
import type { HttpState } from "#github-http/initialize.ts";

export const beforePage = Effect.fn("GitHubHttp.beforePage")(function* (state: HttpState) {
	const context = yield* Effect.context<Context.Service.Identifier<typeof GitHub>>();
	return () => beforeRequest(state).pipe(Effect.provide(context));
});

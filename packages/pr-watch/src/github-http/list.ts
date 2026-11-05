import { Effect, Schema, Stream } from "effect";
import { GitHub } from "@shivaedev/github/github/service.ts";
import { beforePage } from "#github-http/adapters/beforePage.ts";
import { counted } from "#github-http/counted.ts";
import type { HttpState } from "#github-http/initialize.ts";
import { request } from "#github-http/request.ts";

export function list(state: HttpState) {
	return Effect.fn("GitHubHttp.list")((url: string) =>
		Effect.gen(function* () {
			const github = yield* GitHub;
			const before = yield* beforePage(state);
			return yield* request(
				state,
				Stream.unwrap(github.list(url, before)).pipe(
					Stream.mapEffect((response) => counted(state, response.decode(Schema.Unknown))),
					Stream.runCollect,
				),
			);
		}),
	);
}

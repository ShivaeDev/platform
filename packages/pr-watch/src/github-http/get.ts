import { Effect, Schema } from "effect";
import { GitHub } from "@shivaedev/github/GitHub.ts";
import { counted } from "#github-http/counted.ts";
import type { HttpState } from "#github-http/initialize.ts";
import { request } from "#github-http/request.ts";

export function get(state: HttpState) {
	return Effect.fn("GitHubHttp.get")((url: string) =>
		Effect.gen(function* () {
			const github = yield* GitHub;
			return yield* request(state, counted(state, github.read(url)).pipe(Effect.flatMap((response) => response.decode(Schema.Unknown))));
		}),
	);
}

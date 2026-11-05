import { Effect, Schema } from "effect";
import { GitHub } from "@shivaedev/github/github/service.ts";
import { counted } from "#github-http/counted.ts";
import type { HttpState } from "#github-http/initialize.ts";
import { request } from "#github-http/request.ts";

export function post(state: HttpState) {
	return Effect.fn("GitHubHttp.post")((url: string, body: unknown) =>
		Effect.gen(function* () {
			const github = yield* GitHub;
			return yield* request(
				state,
				counted(state, github.write("POST", url, body)).pipe(Effect.flatMap((response) => response.decode(Schema.Unknown))),
			);
		}),
	);
}

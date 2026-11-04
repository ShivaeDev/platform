import { Effect, Schema } from "effect";
import { decode } from "#GitHub/decode.ts";
import { GitHubHttp } from "#GitHubHttp.ts";
import type { Options } from "#model.ts";

const ListedPull = Schema.Struct({ number: Schema.Int });
export const discover = Effect.fn("GitHub.discover")((options: Options) =>
	Effect.gen(function* () {
		const http = yield* GitHubHttp;
		const bodies = yield* http.list(`${options.apiUrl}/repos/${options.repository}/pulls?state=open&per_page=100`);
		const lists = yield* Effect.forEach(bodies, (body) => decode(Schema.Array(ListedPull), body));
		return lists.flat().map((pr) => pr.number);
	}),
);

import { Effect, Schema } from "effect";
import { decode } from "#GitHub/decode.ts";
import { GitHubHttp } from "#GitHubHttp.ts";
import type { Options } from "#model.ts";

const Ref = Schema.Struct({ ref: Schema.String });
export const queue = Effect.fn("GitHub.queue")((options: Options) =>
	Effect.gen(function* () {
		const http = yield* GitHubHttp;
		const bodies = yield* http.list(`${options.apiUrl}/repos/${options.repository}/git/matching-refs/heads/gh-readonly-queue/`);
		const lists = yield* Effect.forEach(bodies, (body) => decode(Schema.Array(Ref), body));
		return new Set(
			lists.flat().flatMap(({ ref }) => {
				const number = ref.match(/\/pr-(?<number>\d+)-/u)?.groups?.number;
				return number === undefined ? [] : [Number(number)];
			}),
		);
	}),
);

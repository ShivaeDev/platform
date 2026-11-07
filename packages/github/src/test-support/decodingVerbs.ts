import { Context, Effect, Schema, SchemaGetter } from "effect";
import type { GitHub } from "#github/service.ts";
import { read } from "#read.ts";
import { PullRequest } from "#test/fixtures.ts";
import { write } from "#write.ts";

class TitlePrefix extends Context.Service<TitlePrefix, string>()("@shivaedev/github/test/ResponseTitlePrefix") {}

const WithPrefix = PullRequest.pipe(
	Schema.decodeTo(PullRequest, {
		decode: SchemaGetter.transformEffect((item: typeof PullRequest.Type) =>
			Effect.map(TitlePrefix, (prefix) => ({ ...item, title: prefix + item.title })),
		),
		encode: SchemaGetter.passthrough(),
	}),
);

export function decodingVerbs(context: Context.Context<Context.Service.Identifier<typeof GitHub>>, tell: (line: string) => void) {
	return {
		readPullWithPrefix: (prefix: string) =>
			Effect.suspend(() => {
				tell("the client reads pull request 1 through a Schema requiring a title prefix service");
				return read("/repos/acme/widgets/pulls/1", WithPrefix).pipe(Effect.provide(context), Effect.provideService(TitlePrefix, prefix));
			}),
		writeIssueWithPrefix: (title: string, prefix: string) =>
			Effect.suspend(() => {
				tell("the client opens an issue through a response Schema requiring a title prefix service");
				return write("POST", "/repos/acme/widgets/issues", { title }, WithPrefix).pipe(
					Effect.provide(context),
					Effect.provideService(TitlePrefix, prefix),
				);
			}),
	};
}

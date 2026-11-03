import { Context, Effect, Schema, SchemaGetter, Stream } from "effect";
import { expectTypeOf } from "vitest";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { CreateCheckRun } from "#checkRuns.ts";
import { GitHub, list, listBounded, listPages, read, write } from "#GitHub.ts";

const deleted = write("DELETE", "/repos/acme/widgets/issues/comments/7");
const changed = write("PUT", "/repos/acme/widgets/issues/1/labels", { labels: ["ready"] }, Schema.Array(Schema.Struct({ name: Schema.String })));
expectTypeOf<Effect.Success<typeof deleted>>().toEqualTypeOf<void>();
expectTypeOf<Effect.Success<typeof changed>>().toEqualTypeOf<ReadonlyArray<{ readonly name: string }>>();

const completed: typeof CreateCheckRun.Type = { conclusion: "success", headSha: "abc", name: "Coverage", status: "completed" };
// @ts-expect-error Completed creates require a conclusion.
const missingConclusion: typeof CreateCheckRun.Type = { headSha: "abc", name: "Coverage", status: "completed" };

const invalidCreate = Effect.flatMap(GitHub, (github) => {
	// @ts-expect-error The service also requires a conclusion for completed creates.
	return github.createCheckRun("acme", "widgets", { headSha: "abc", name: "Coverage", status: "completed" });
});
// @ts-expect-error GitHub Apps cannot create an Actions-only status.
const waiting: typeof CreateCheckRun.Type = { headSha: "abc", name: "Coverage", status: "waiting" };
void [completed, missingConclusion, invalidCreate, waiting];

class DecoderPrefix extends Context.Service<DecoderPrefix, string>()("@shivaedev/github/types/DecoderPrefix") {}
const WithService = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transformEffect((value: string) => Effect.map(DecoderPrefix, (prefix) => prefix + value)),
		encode: SchemaGetter.passthrough(),
	}),
);
const readWithService = read("/item", WithService);
const writeWithService = write("POST", "/items", { title: "New" }, WithService);
expectTypeOf<Effect.Services<typeof readWithService>>().toEqualTypeOf<Context.Service.Identifier<typeof GitHub> | DecoderPrefix>();
expectTypeOf<Effect.Services<typeof writeWithService>>().toEqualTypeOf<Context.Service.Identifier<typeof GitHub> | DecoderPrefix>();

const streamed = list("/items", WithService, { arrayKey: "items", onDecodeError: "skip" });
const paged = listPages("/items", WithService, { arrayKey: "items" });
const bounded = listBounded("/items", WithService, 2, { onDecodeError: "skip" });
expectTypeOf<Stream.Services<typeof streamed>>().toEqualTypeOf<Context.Service.Identifier<typeof GitHub> | DecoderPrefix>();
expectTypeOf<Stream.Services<typeof paged>>().toEqualTypeOf<Context.Service.Identifier<typeof GitHub> | DecoderPrefix>();
expectTypeOf<Effect.Services<typeof bounded>>().toEqualTypeOf<Context.Service.Identifier<typeof GitHub> | DecoderPrefix>();
expectTypeOf<Effect.Success<typeof bounded>>().toEqualTypeOf<{ items: string[]; skipped: number; truncated: boolean }>();

const refusal = { _tag: "PacingRefusal", retryAt: 120_000 } as const;
const pacing = { beforeRequest: () => Effect.fail(refusal) };
const pacedItems = list("/items", Schema.String, pacing);
const pacedPages = listPages("/items", Schema.String, pacing);
const pacedBounded = listBounded("/items", Schema.String, 2, pacing);
const rawPages = Effect.flatMap(GitHub, (github) => github.list("/items", pacing.beforeRequest)).pipe(Effect.flatMap(Stream.runCollect));
const repositoryPages = Effect.flatMap(GitHub, (github) => github.listCommits("acme", "widgets", pacing)).pipe(Effect.flatMap(Stream.runCollect));
expectTypeOf<Extract<Stream.Error<typeof pacedItems>, typeof refusal>>().toEqualTypeOf<typeof refusal>();
expectTypeOf<Extract<Stream.Error<typeof pacedPages>, typeof refusal>>().toEqualTypeOf<typeof refusal>();
expectTypeOf<Extract<Effect.Error<typeof pacedBounded>, typeof refusal>>().toEqualTypeOf<typeof refusal>();
expectTypeOf<Extract<Effect.Error<typeof rawPages>, typeof refusal>>().toEqualTypeOf<typeof refusal>();
expectTypeOf<Extract<Effect.Error<typeof repositoryPages>, typeof refusal>>().toEqualTypeOf<typeof refusal>();

const explicitSchema = list<typeof Schema.String>("/items", Schema.String, {
	beforeRequest: () => Effect.fail(new ServiceUnavailable({ message: "budget spent" })),
});
expectTypeOf<Extract<Stream.Error<typeof explicitSchema>, ServiceUnavailable>>().toEqualTypeOf<ServiceUnavailable>();

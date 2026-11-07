import { Context, Effect, Schema, SchemaGetter, Stream } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { GitHub } from "#github/service.ts";
import type { ListOptions } from "#pagedLists.ts";
import { answered } from "#test/outcome.ts";

class TitlePrefix extends Context.Service<TitlePrefix, string>()("@shivaedev/github/test/TitlePrefix") {}
const Item = Schema.Struct({ title: Schema.String }).pipe(
	Schema.decodeTo(Schema.Struct({ title: Schema.String }), {
		decode: SchemaGetter.transformEffect((item: { readonly title: string }) =>
			Effect.map(TitlePrefix, (prefix) => ({ title: `${prefix}${item.title}` })),
		),
		encode: SchemaGetter.passthrough(),
	}),
);

export function pagedReadVerbs(context: Context.Context<Context.Service.Identifier<typeof GitHub>>, tell: (line: string) => void) {
	const paced: string[] = [];
	function settings(options: ListOptions, refuseAt?: number): ListOptions {
		return {
			...options,
			beforeRequest: (resource) =>
				Effect.suspend(() => {
					paced.push(resource);
					return paced.length === refuseAt ? Effect.fail(new ServiceUnavailable({ message: "pacing budget spent" })) : Effect.void;
				}),
		};
	}
	function run<A, E>(effect: Effect.Effect<A, E, Context.Service.Identifier<typeof GitHub> | TitlePrefix>) {
		return answered(effect.pipe(Effect.provide(context), Effect.provideService(TitlePrefix, "Decoded: ")));
	}
	return {
		collectPaged: (options: ListOptions = {}, pageCap = 10, refuseAt?: number) =>
			Effect.suspend(() => {
				tell(`the client collects /paged with at most ${pageCap} pages and ${options.onDecodeError ?? "fail"} decoding`);
				return run(Effect.flatMap(GitHub, (service) => service.listBounded("/paged", Item, pageCap, settings(options, refuseAt))));
			}),
		pagedPacingCalls: () => Effect.sync(() => [...paced]),
		streamPaged: (options: ListOptions = {}, take = 10) =>
			Effect.suspend(() => {
				tell(`the client streams up to ${take} items from /paged`);
				return run(
					Effect.gen(function* () {
						const service = yield* GitHub;
						const pages = yield* service.listPages("/paged", Item, settings(options));
						const items = Stream.flatMap(pages, (page) => Stream.fromIterable(page.items));
						return yield* Stream.runCollect(Stream.take(items, take));
					}),
				);
			}),
		streamPages: (options: ListOptions = {}) =>
			Effect.suspend(() => {
				tell("the client reads decoded pages from /paged");
				return run(Effect.flatMap(GitHub, (service) => Effect.flatMap(service.listPages("/paged", Item, settings(options)), Stream.runCollect)));
			}),
	};
}

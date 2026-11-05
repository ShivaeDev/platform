import { Effect, Option, Schema, Stream } from "effect";
import type { jsonResponse } from "#json.ts";
import type { ListOptions } from "#pagedLists.ts";

export function decodePages<TSchema extends Schema.Constraint, E, R>(
	pages: Stream.Stream<ReturnType<typeof jsonResponse> & { readonly hasNext: boolean }, E, R>,
	schema: TSchema,
	options: ListOptions<unknown> | number = {},
) {
	const settings = typeof options === "number" ? { responseByteLimit: options } : options;
	const decode = Schema.decodeUnknownEffect(schema);
	return pages.pipe(
		Stream.mapEffect((page) =>
			Effect.gen(function* () {
				const body = yield* page.decode(Schema.Unknown);
				const source =
					settings.arrayKey === undefined
						? body
						: (yield* Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Unknown))(body))[settings.arrayKey];
				const values = yield* Schema.decodeUnknownEffect(Schema.Array(Schema.Unknown))(source);
				const decoded = yield* Effect.forEach(values, (value) =>
					decode(value).pipe(
						Effect.map(Option.some),
						Effect.catchTag("SchemaError", (error) => (settings.onDecodeError === "skip" ? Effect.succeed(Option.none()) : Effect.fail(error))),
					),
				);
				const items = decoded.flatMap(Option.toArray);
				return { hasNext: page.hasNext, items, skipped: values.length - items.length };
			}),
		),
	);
}

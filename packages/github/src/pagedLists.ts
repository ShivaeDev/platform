import { Effect, Option, Schema, Stream } from "effect";
import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { Representations } from "#representations.ts";

export interface ListOptions {
	readonly arrayKey?: string | undefined;
	readonly beforeRequest?: (resource: string) => Effect.Effect<void, ServiceUnavailable>;
	readonly onDecodeError?: "fail" | "skip" | undefined;
	readonly responseByteLimit?: number | undefined;
}

export function decodedPages<TSchema extends Schema.Constraint>(
	client: Representations,
	path: string,
	schema: TSchema,
	options: ListOptions | number = {},
) {
	const settings = typeof options === "number" ? { responseByteLimit: options } : options;
	const decode = Schema.decodeUnknownEffect(schema);
	return Stream.unwrap(client.list(path, settings.beforeRequest, settings.responseByteLimit)).pipe(
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

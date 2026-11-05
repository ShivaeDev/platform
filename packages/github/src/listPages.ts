import { Effect, type Schema, Stream } from "effect";
import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { decodePages } from "#decodePages.ts";
import { GitHub } from "#github/service.ts";
import type { ListOptions } from "#pagedLists.ts";

export function listPages<TSchema extends Schema.Constraint, E = ServiceUnavailable>(
	path: string,
	schema: TSchema,
	options?: ListOptions<E> | number,
) {
	const settings = typeof options === "number" ? { responseByteLimit: options } : options;
	const pages = Stream.unwrap(Effect.flatMap(GitHub, (github) => github.list(path, settings?.beforeRequest, settings?.responseByteLimit)));
	return decodePages(pages, schema, settings);
}

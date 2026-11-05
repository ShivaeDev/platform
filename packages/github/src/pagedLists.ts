import { type Effect, type Schema, Stream } from "effect";
import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { decodePages } from "#decodePages.ts";
import { list } from "#github/list.ts";
import type { GitHubState } from "#initializeGitHub.ts";

export interface ListOptions<E = ServiceUnavailable> {
	readonly arrayKey?: string | undefined;
	readonly beforeRequest?: (resource: string) => Effect.Effect<void, E>;
	readonly onDecodeError?: "fail" | "skip" | undefined;
	readonly responseByteLimit?: number | undefined;
}

export function decodedPages<TSchema extends Schema.Constraint, E = ServiceUnavailable>(
	state: GitHubState,
	path: string,
	schema: TSchema,
	options: ListOptions<E> | number = {},
) {
	const settings = typeof options === "number" ? { responseByteLimit: options } : options;
	return decodePages(Stream.unwrap(list(state)(path, settings.beforeRequest, settings.responseByteLimit)), schema, settings);
}

import { Effect, Schema } from "effect";
import { GitHub } from "#github/service.ts";

type WriteMethod = "POST" | "PATCH" | "PUT" | "DELETE";

export function write<TSchema extends Schema.Constraint>(
	method: WriteMethod,
	path: string,
	body: unknown,
	schema: TSchema,
	responseByteLimit?: number,
): ReturnType<typeof writeDecoded<TSchema>>;
export function write(method: WriteMethod, path: string, body?: unknown): ReturnType<typeof writeDecoded<typeof Schema.Void>>;
export function write(method: WriteMethod, path: string, body?: unknown, schema: Schema.Constraint = Schema.Void, responseByteLimit?: number) {
	return writeDecoded(method, path, body, schema, responseByteLimit);
}

function writeDecoded<TSchema extends Schema.Constraint>(
	method: WriteMethod,
	path: string,
	body: unknown,
	schema: TSchema,
	responseByteLimit?: number,
) {
	return Effect.flatMap(GitHub, (github) =>
		Effect.flatMap(github.write(method, path, body, responseByteLimit), (response) => response.decode(schema)),
	);
}

import { Effect, type Schema } from "effect";
import { GitHub } from "#GitHub.ts";

export function read<TSchema extends Schema.Constraint>(path: string, schema: TSchema, responseByteLimit?: number) {
	return Effect.flatMap(GitHub, (github) => Effect.flatMap(github.read(path, responseByteLimit), (response) => response.decode(schema)));
}

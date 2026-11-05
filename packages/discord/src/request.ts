import { Effect, Schema } from "effect";
import type { HttpMethod } from "effect/http/HttpMethod";
import { DiscordRest } from "#rest/service.ts";

export function request<TSchema extends Schema.ConstraintDecoder<unknown>>(method: HttpMethod, path: string, schema: TSchema, body?: unknown) {
	return Effect.flatMap(DiscordRest, (rest) => rest.request(method, path, body)).pipe(Effect.flatMap(Schema.decodeUnknownEffect(schema)));
}

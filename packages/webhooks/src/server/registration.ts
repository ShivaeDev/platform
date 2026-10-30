import { type Config, Effect, type Option, type Redacted, Schema } from "effect";
import type { JobPayloadSchema, QueueDefinition } from "@shivaedev/jobs/server/definition.ts";
import type { PgBossError, PgBossPayloadError } from "@shivaedev/jobs/server/error.ts";
import type { PgBossService } from "@shivaedev/jobs/server/service.ts";
import type { WebhookUnauthorized } from "#server/WebhookUnauthorized.ts";

const enqueue = Symbol("WebhookJob.enqueue");

export interface WebhookJob<R = never> {
	readonly [enqueue]: (jobs: PgBossService) => Effect.Effect<Option.Option<string>, PgBossError | PgBossPayloadError, R>;
}

export function webhookJob<const TName extends string, TPayload extends JobPayloadSchema>(
	queue: QueueDefinition<TName, TPayload>,
	payload: NoInfer<Schema.Schema.Type<TPayload>>,
): WebhookJob<TPayload["EncodingServices"]> {
	return { [enqueue]: (jobs) => jobs.enqueue(queue, payload) };
}

export interface WebhookEvent<R = never, E = never> {
	readonly decode: (body: Uint8Array) => Effect.Effect<readonly WebhookJob<R>[], Schema.SchemaError | E, R>;
}

export function webhookEvent<TSchema extends Schema.Constraint, R = never, E = never>(
	schema: TSchema,
	jobs: (payload: TSchema["Type"]) => readonly WebhookJob<R>[] | Effect.Effect<readonly WebhookJob<R>[], E, R>,
): WebhookEvent<TSchema["DecodingServices"] | R, E> {
	return {
		decode: (body) =>
			Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(new TextDecoder().decode(body)).pipe(
				Effect.flatMap((payload) => {
					const result = jobs(payload);
					return Effect.isEffect(result) ? result : Effect.succeed(result);
				}),
			),
	};
}

export interface WebhookSource<R = never, E = never> {
	readonly events: Readonly<Record<string, WebhookEvent<R, E>>>;
	readonly key: Config.Config<Redacted.Redacted<string>>;
	readonly strategy: WebhookStrategy;
}

export interface WebhookStrategy {
	readonly delivery: (headers: Readonly<Record<string, string>>) => { readonly id: string | undefined; readonly event: string | undefined };
	readonly verify: (
		body: Uint8Array,
		headers: Readonly<Record<string, string>>,
		key: Redacted.Redacted<string>,
	) => Effect.Effect<void, WebhookUnauthorized>;
}

export function enqueueWebhookJobs<R>(requests: readonly WebhookJob<R>[], jobs: PgBossService) {
	return Effect.forEach(requests, (request) => request[enqueue](jobs));
}

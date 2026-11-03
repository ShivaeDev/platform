import { type Config, Effect, type Option, type Redacted, Schema } from "effect";
import type { JobPayloadSchema, QueueDefinition } from "@shivaedev/jobs/server/definition.ts";
import type { EnqueueOptions } from "@shivaedev/jobs/server/enqueueOptions.ts";
import type { PgBossError, PgBossPayloadError } from "@shivaedev/jobs/server/error.ts";
import { WebhookEnqueue } from "#server/WebhookEnqueue.ts";
import { WebhookPayloadError } from "#server/WebhookPayloadError.ts";
import type { WebhookUnauthorized } from "#server/WebhookUnauthorized.ts";

const enqueue = Symbol("WebhookJob.enqueue");

export interface WebhookJob<R = never> {
	readonly [enqueue]: Effect.Effect<Option.Option<string>, PgBossError | PgBossPayloadError, R | WebhookEnqueue>;
}

export function webhookJob<
	const TName extends string,
	TPayload extends JobPayloadSchema,
	const TQueue extends QueueDefinition<TName, TPayload> = QueueDefinition<TName, TPayload>,
>(
	queue: QueueDefinition<TName, TPayload> & TQueue,
	payload: NoInfer<Schema.Schema.Type<TPayload>>,
	options?: NoInfer<TQueue["key"] extends undefined ? EnqueueOptions : Omit<EnqueueOptions, "singletonKey"> & { readonly singletonKey?: never }>,
): WebhookJob<TPayload["EncodingServices"]> {
	return { [enqueue]: Effect.flatMap(WebhookEnqueue, (jobs) => jobs.enqueue(queue, payload, options)) };
}

export interface WebhookDelivery {
	readonly event: string;
	readonly id: string;
	readonly source: string;
}

export interface WebhookEvent<R = never, E = never> {
	readonly decode: (body: Uint8Array, delivery: WebhookDelivery) => Effect.Effect<readonly WebhookJob<R>[], WebhookPayloadError | E, R>;
}

export function webhookEvent<TSchema extends Schema.Constraint, R = never, E = never>(
	schema: TSchema,
	jobs: (payload: TSchema["Type"], delivery: WebhookDelivery) => readonly WebhookJob<R>[] | Effect.Effect<readonly WebhookJob<R>[], E, R>,
): WebhookEvent<TSchema["DecodingServices"] | R, E> {
	return {
		decode: (body, delivery) =>
			Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(new TextDecoder().decode(body)).pipe(
				Effect.mapError((cause) => new WebhookPayloadError({ cause })),
				Effect.flatMap((payload) => {
					const result = jobs(payload, delivery);
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

export function enqueueWebhookJobs<R>(requests: readonly WebhookJob<R>[]) {
	return Effect.forEach(requests, (request) => request[enqueue]);
}

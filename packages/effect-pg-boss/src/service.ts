import { Context, Effect, Layer, type Option, type Schema } from "effect";
import type { ConstructorOptions, SendOptions, StopOptions } from "pg-boss";
import type { JobPayloadSchema, JobRegistration, QueueDefinition, RegistrationRequirements } from "./definition.ts";
import type { PgBossError, PgBossPayloadError } from "./error.ts";
import type { JobsHealth } from "./health.ts";
import type { PgBossClientFactory } from "./internal/client.ts";
import { acquireClient, releaseClient } from "./internal/lifecycle.ts";
import { registerJobs, registrationName } from "./internal/register.ts";
import { makeService } from "./internal/service.ts";

export interface PgBossService {
	readonly enqueue: <const Name extends string, const Payload extends JobPayloadSchema>(
		queue: QueueDefinition<Name, Payload>,
		payload: Schema.Schema.Type<Payload>,
		options?: SendOptions,
	) => Effect.Effect<Option.Option<string>, PgBossError | PgBossPayloadError, Payload["EncodingServices"]>;
	readonly health: Effect.Effect<JobsHealth, PgBossError>;
}

interface PgBossIdentifier {
	readonly _pgBossIdentifier: unique symbol;
}

export type PgBossLayerOptions<Registrations extends readonly JobRegistration[], ErrorRequirements> = ConstructorOptions & {
	readonly clientFactory?: PgBossClientFactory;
	// One started client is reference-counted per key, so development module reloads reuse it instead of starting another.
	readonly clientCacheKey?: string | symbol | undefined;
	readonly jobs: Registrations;
	readonly onError?: (error: Error) => Effect.Effect<unknown, never, ErrorRequirements>;
	readonly stop?: StopOptions;
};

export interface PgBossDefinition extends Context.Service<PgBossIdentifier, PgBossService> {
	readonly layer: <const Registrations extends readonly JobRegistration[], ErrorRequirements = never>(
		options: PgBossLayerOptions<Registrations, ErrorRequirements>,
	) => Layer.Layer<PgBossIdentifier, PgBossError, RegistrationRequirements<Registrations> | ErrorRequirements>;
}

const logClientError = (error: Error): Effect.Effect<void> => Effect.logError({ event: "pg_boss_error", message: error.message });

export const makePgBoss = (identifier: string): PgBossDefinition => {
	const Service = Context.Service<PgBossIdentifier, PgBossService>(identifier);

	const layer = <const Registrations extends readonly JobRegistration[], ErrorRequirements = never>(
		options: PgBossLayerOptions<Registrations, ErrorRequirements>,
	): Layer.Layer<PgBossIdentifier, PgBossError, RegistrationRequirements<Registrations> | ErrorRequirements> => {
		type Requirements = RegistrationRequirements<Registrations> | ErrorRequirements;
		const names = options.jobs.map(registrationName);
		const { clientFactory, clientCacheKey, jobs, onError, stop, ...constructorOptions } = options;

		const acquire = Effect.acquireRelease(
			Effect.gen(function* () {
				const context = yield* Effect.context<Requirements>();
				const acquired = yield* acquireClient({
					clientCacheKey,
					clientFactory,
					constructor: constructorOptions,
				});
				const reportError: (error: Error) => Effect.Effect<unknown, never, Requirements> = onError ?? logClientError;
				const errorListener = (error: Error) => {
					void Effect.runPromise(Effect.exit(Effect.provide(reportError(error), context)));
				};
				acquired.client.on("error", errorListener);
				const registration = registerJobs(acquired.client, jobs, context, acquired.reused);
				return yield* registration.pipe(
					Effect.as({ acquired, context, errorListener }),
					Effect.onError(() => {
						acquired.client.off("error", errorListener);
						return releaseClient(acquired, stop);
					}),
				);
			}),
			(resource) => {
				resource.acquired.client.off("error", resource.errorListener);
				return releaseClient(resource.acquired, stop);
			},
		);

		return Layer.effect(
			Service,
			Effect.map(acquire, ({ acquired }) => makeService(acquired.client, names)),
		);
	};

	return Object.assign(Service, { layer });
};

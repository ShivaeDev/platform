import { Context, Effect, Layer, type Option, type Schema } from "effect";
import type { ConstructorOptions, SendOptions, StopOptions } from "pg-boss";
import type {
	JobPayloadSchema,
	JobRegistration,
	QueueDefinition,
	RegistrationRequirements,
} from "./definition.js";
import type { PgBossError, PgBossPayloadError } from "./error.js";
import type { JobsHealth } from "./health.js";
import type { PgBossClientFactory } from "./internal/client.js";
import { acquireClient, releaseClient } from "./internal/lifecycle.js";
import { registerJobs } from "./internal/register.js";
import { makeService } from "./internal/service.js";

export interface PgBossService {
	readonly enqueue: <
		const Name extends string,
		const Payload extends JobPayloadSchema,
	>(
		queue: QueueDefinition<Name, Payload>,
		payload: Schema.Schema.Type<Payload>,
		options?: SendOptions,
	) => Effect.Effect<
		Option.Option<string>,
		PgBossError | PgBossPayloadError,
		Payload["EncodingServices"]
	>;
	readonly health: Effect.Effect<JobsHealth, PgBossError>;
}

interface PgBossIdentifier {
	readonly _pgBossIdentifier: unique symbol;
}

export type PgBossLayerOptions<
	Registrations extends readonly JobRegistration[],
	ErrorRequirements,
> = ConstructorOptions & {
	/** Override client construction for compatible clients or deterministic tests. */
	readonly clientFactory?: PgBossClientFactory;
	readonly developmentCacheKey?: string | symbol;
	readonly jobs: Registrations;
	readonly onError?: (
		error: Error,
	) => Effect.Effect<unknown, never, ErrorRequirements>;
	readonly stop?: StopOptions;
};

export interface PgBossDefinition
	extends Context.Service<PgBossIdentifier, PgBossService> {
	readonly layer: <
		const Registrations extends readonly JobRegistration[],
		ErrorRequirements = never,
	>(
		options: PgBossLayerOptions<Registrations, ErrorRequirements>,
	) => Layer.Layer<
		PgBossIdentifier,
		PgBossError,
		RegistrationRequirements<Registrations> | ErrorRequirements
	>;
}

export const makePgBoss = (identifier: string): PgBossDefinition => {
	const Service = Context.Service<PgBossIdentifier, PgBossService>(identifier);

	const layer = <
		const Registrations extends readonly JobRegistration[],
		ErrorRequirements = never,
	>(
		options: PgBossLayerOptions<Registrations, ErrorRequirements>,
	): Layer.Layer<
		PgBossIdentifier,
		PgBossError,
		RegistrationRequirements<Registrations> | ErrorRequirements
	> => {
		type Requirements =
			| RegistrationRequirements<Registrations>
			| ErrorRequirements;
		const names = options.jobs.map((registration) =>
			registration._tag === "QueueWorker"
				? (registration as import("./definition.js").QueueWorker).queue.name
				: (registration as import("./definition.js").ScheduledWorker).schedule
						.name,
		);
		const {
			clientFactory,
			developmentCacheKey,
			jobs,
			onError,
			stop,
			...constructorOptions
		} = options;

		const acquire = Effect.acquireRelease(
			Effect.gen(function* () {
				const context = yield* Effect.context<Requirements>();
				const acquired = yield* acquireClient({
					clientFactory,
					constructor: constructorOptions,
					developmentCacheKey,
				});
				const reportError: (
					error: Error,
				) => Effect.Effect<unknown, never, Requirements> =
					onError === undefined
						? (error) =>
								Effect.logError({
									event: "pg_boss_error",
									message: error.message,
								})
						: onError;
				const errorListener = (error: Error) => {
					void Effect.runPromise(
						Effect.exit(Effect.provide(reportError(error), context)),
					);
				};
				acquired.client.on("error", errorListener);
				const registration = registerJobs(
					acquired.client,
					jobs,
					context,
					acquired.reused,
				);
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
			Effect.map(acquire, ({ acquired }) =>
				makeService(acquired.client, names),
			),
		);
	};

	return Object.assign(Service, { layer }) as PgBossDefinition;
};

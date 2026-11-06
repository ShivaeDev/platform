import { type Context, Effect, Exit, Layer, Scope } from "effect";
import { clientErrorReporter } from "#server/adapters/clientErrorReporter.ts";
import { clientErrorSubscription } from "#server/adapters/clientErrorSubscription.ts";
import { logClientError } from "#server/clientErrors.ts";
import type { JobRegistration, RegistrationRequirements } from "#server/definition.ts";
import type { PgBossError, PgBossQueueNamesError, PgBossQueueOptionsError } from "#server/error.ts";
import { PgBoss } from "#server/PgBoss.ts";
import type { PgBossLayerOptions, PgBossService } from "#server/service.ts";
import { validateQueueNames } from "#server/validateQueueNames.ts";
import { makeService } from "./makeService.ts";
import { operationsLayer } from "./operationsLayer.ts";
import { registrationName } from "./register.ts";
import { registerReleasedJobs } from "./registerReleasedJobs.ts";

export function pgBossDefinitionLayer<TIdentifier extends string, const TRegistrations extends readonly JobRegistration[], E>(
	Service: Context.Service<TIdentifier, PgBossService>,
	options: PgBossLayerOptions<TRegistrations, E>,
	queueNames?: readonly string[],
): Layer.Layer<
	TIdentifier,
	PgBossError | PgBossQueueNamesError | PgBossQueueOptionsError,
	PgBoss | Exclude<RegistrationRequirements<TRegistrations>, TIdentifier> | E
>;
export function pgBossDefinitionLayer<TIdentifier extends string, R, E>(
	Service: Context.Service<TIdentifier, PgBossService>,
	options: PgBossLayerOptions<readonly JobRegistration<R>[], E>,
	queueNames?: readonly string[],
) {
	return Layer.unwrap(
		Effect.map(Effect.context<Exclude<R, TIdentifier> | E>(), (dependencies) =>
			Layer.effect(
				Service,
				Effect.gen(function* () {
					yield* validateQueueNames(options.jobs, queueNames);
					const acquired = yield* PgBoss;
					const workerScope = yield* Scope.make();
					const services = yield* Layer.build(operationsLayer(options.jobs.map(registrationName)));
					const service = yield* makeService().pipe(Effect.provide(services));
					yield* Effect.gen(function* () {
						const context = yield* Effect.context<R | E>();
						const reportError = options.onError ?? logClientError;
						const report = yield* clientErrorReporter(reportError).pipe(Effect.provide(context));
						const unsubscribe = yield* clientErrorSubscription(acquired.client, report);
						yield* Effect.addFinalizer(() => Scope.close(workerScope, Exit.void).pipe(Effect.ensuring(Effect.sync(unsubscribe))));
						yield* registerReleasedJobs(acquired.client, options.jobs, acquired.reused, acquired.schema, acquired.stop, options.retired).pipe(
							Effect.provideService(Scope.Scope, workerScope),
						);
					}).pipe(Effect.provideService(Service, service), Effect.provide(dependencies));
					return service;
				}),
			),
		),
	);
}

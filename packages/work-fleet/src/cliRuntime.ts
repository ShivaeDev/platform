import { Console, Effect, Layer } from "effect";
import { prepareDatabase, protectDatabase, writeViews } from "./cliStorage.ts";
import { codexLayer } from "./codex.ts";
import { databaseLayer } from "./databaseLayer.ts";
import { Fleet } from "./Fleet.ts";
import { GitHubLive } from "./GitHubLive.ts";
import { Agent, ChangeHost, failure } from "./ports.ts";
import { Store } from "./Store.ts";
import { scriptedLayer } from "./scriptedLayer.ts";

function disabled() {
	return Effect.fail(failure("This command does not enable external operations"));
}
const administrativePorts = Layer.merge(
	Layer.succeed(Agent, { backendId: "disabled", launch: disabled, observe: disabled }),
	Layer.succeed(ChangeHost, {
		backendId: "disabled",
		findPublished: disabled,
		merge: disabled,
		observe: disabled,
		publish: disabled,
		verifyChange: disabled,
		verifyNoChange: disabled,
	}),
);
export function withAdministrativeFleet<A, E, R>(filename: string, operation: (database: string) => Effect.Effect<A, E, R>) {
	return Effect.gen(function* () {
		const database = yield* prepareDatabase(filename);
		return yield* operation(database).pipe(
			Effect.provide(Fleet.layer.pipe(Layer.provide(administrativePorts), Layer.provide(Store.layer.pipe(Layer.provide(databaseLayer(database)))))),
		);
	});
}
export interface ExecutionOptions {
	readonly backend: "codex-local" | "scripted";
	readonly database: string;
	readonly output: string;
}
export function execute(options: ExecutionOptions, interval?: number) {
	return Effect.gen(function* () {
		if (interval !== undefined && interval < 1) {
			return yield* Effect.fail(failure("The interval must be at least one second"));
		}
		const database = yield* prepareDatabase(options.database);
		const backend = options.backend === "scripted" ? scriptedLayer() : Layer.merge(codexLayer(), GitHubLive());
		const application = Fleet.layer.pipe(Layer.provide(backend), Layer.provide(Store.layer.pipe(Layer.provide(databaseLayer(database)))));
		const operation = Effect.gen(function* () {
			const fleet = yield* Fleet;
			const snapshot = yield* fleet.snapshot();
			yield* protectDatabase(
				database,
				snapshot.works.map((work) => work.spec),
			);
			yield* fleet.tick();
			yield* writeViews(yield* fleet.snapshot(), options.output);
		});
		return yield* (
			interval === undefined
				? operation
				: operation.pipe(
						Effect.catch((error) => Console.error(`Fleet reconciliation failed: ${String(error)}`)),
						Effect.andThen(Effect.sleep(interval * 1000)),
						Effect.forever,
					)
		).pipe(Effect.provide(application));
	});
}

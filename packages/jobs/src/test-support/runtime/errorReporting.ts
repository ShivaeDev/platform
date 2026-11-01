import { Deferred, Effect } from "effect";
import { ApplicationLog } from "#test/workers.ts";
import { type RuntimeEngine, runningIn } from "./engine.ts";

export const holdErrorReport = Effect.fnUntraced(function* (engine: RuntimeEngine, interruptible: boolean) {
	const state = engine.errorReport;
	yield* Effect.addFinalizer(() => Deferred.succeed(state.allowed, undefined));
	engine.options = {
		...engine.options,
		onError: (error) => {
			const report = Effect.gen(function* () {
				const note = yield* ApplicationLog;
				yield* Effect.sync(() => note(`onError started: ${error.message}`));
				yield* Deferred.succeed(state.started, undefined);
				yield* Deferred.await(state.allowed);
				yield* Effect.sync(() => note(`onError finished: ${error.message}`));
			}).pipe(
				Effect.onInterrupt(() => Effect.flatMap(ApplicationLog, (note) => Effect.sync(() => note(`onError interrupted: ${error.message}`)))),
				Effect.ensuring(Deferred.succeed(state.finished, undefined)),
			);
			return interruptible ? report : Effect.uninterruptible(report);
		},
	};
});

export function errorReportingVerbs(engine: RuntimeEngine, tell: (line: string) => void) {
	return {
		allowErrorReport: () => {
			tell("the application allows its pending onError to finish");
			return Deferred.succeed(engine.errorReport.allowed, undefined);
		},
		errorReportFinishes: () => {
			tell("the application's onError finishes");
			return Deferred.await(engine.errorReport.finished);
		},
		errorReportStarts: () => {
			tell("the application's onError starts");
			return Deferred.await(engine.errorReport.started);
		},
		runtimeReleased: () => Deferred.isDone(engine.errorReport.stopped),
		startStoppingDuringErrorReport: (name: string) => {
			tell(`${name} starts stopping while its onError is still pending`);
			return Effect.gen(function* () {
				yield* runningIn(engine, name).stop.pipe(
					Effect.andThen(Deferred.succeed(engine.errorReport.stopped, undefined)),
					Effect.forkScoped({ startImmediately: true }),
				);
				// Release the uninterruptible callback before a failed story waits for its shutdown fiber.
				yield* Effect.addFinalizer(() => Deferred.succeed(engine.errorReport.allowed, undefined));
			});
		},
		stopFinishes: () => {
			tell("the runtime finishes stopping");
			return Deferred.await(engine.errorReport.stopped);
		},
	};
}

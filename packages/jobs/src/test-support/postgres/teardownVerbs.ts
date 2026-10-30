import { Effect, Fiber } from "effect";
import type { DatabaseEngine } from "./databaseEngine.ts";
import type { DisconnectGate } from "./disconnectGate.ts";
import { runningIn } from "./engine.ts";

type Tell = (line: string) => void;

function gateOf(engine: DatabaseEngine): DisconnectGate {
	if (engine.gate === undefined) {
		throw new Error("No disconnect gate stands in front of the database");
	}
	return engine.gate;
}

export function teardownVerbs(engine: DatabaseEngine, tell: Tell) {
	return {
		backends: (applicationName: string) =>
			engine.sql<{ readonly pid: number }>`select pid from pg_stat_activity where application_name = ${applicationName}`.pipe(
				Effect.map((rows) => rows.length),
			),
		releaseDisconnects: () => {
			tell("the disconnect gate passes the held disconnect acknowledgements on");
			return Effect.sync(() => gateOf(engine).release());
		},
		shutdown: (name: string) =>
			Effect.sync(() => {
				const fiber = engine.stopping.get(name);
				if (fiber === undefined) {
					return "never asked to stop";
				}
				return fiber.pollUnsafe() === undefined ? "still stopping" : "stopped";
			}),
		stopInBackground: (name: string) => {
			tell(`${name} starts stopping`);
			return Effect.suspend(() => Effect.forkScoped(runningIn(engine, name).stop)).pipe(
				Effect.flatMap((fiber) =>
					Effect.sync(() => {
						engine.stopping.set(name, fiber);
						engine.runtimes.delete(name);
					}),
				),
			);
		},
		untilDisconnectsHeld: () => {
			tell("wait until the disconnect gate holds every acknowledgement from PostgreSQL");
			return Effect.promise(() => gateOf(engine).allHeld).pipe(Effect.timeout("20 seconds"));
		},
		untilStopped: (name: string) => {
			tell(`wait until ${name} has stopped`);
			return Effect.suspend(() => {
				const fiber = engine.stopping.get(name);
				return fiber === undefined ? Effect.die(new Error(`${name} was never asked to stop`)) : Fiber.join(fiber).pipe(Effect.timeout("20 seconds"));
			});
		},
	};
}

import { Effect, PlatformError } from "effect";
import { type ChildProcess, ChildProcessSpawner } from "effect/process";
import { LOCAL_SERVER, localPostgres, type ReadinessOptions } from "#localPostgres.ts";
import { dockerScript } from "#test/dockerScript.ts";
import { scriptedProcess } from "#test/scriptedProcess.ts";

export function databaseUrl(name: string) {
	return `${LOCAL_SERVER}/${name}`;
}

export const SERVER = databaseUrl("postgres");

export interface PostgresEngine {
	appDatabase: string | undefined;
	calls: (readonly string[])[];
	environment: { "DOCKER_CONTEXT"?: string | undefined; "DOCKER_HOST"?: string | undefined };
	failure: unknown;
	hostClient?: (command: ChildProcess.StandardCommand) => ChildProcess.StandardCommand;
	hostPsql: boolean;
	manager: ReturnType<typeof localPostgres>;
	mode: "scripted" | "real";
	outcome: string | undefined;
	plan: Parameters<typeof dockerScript>[0][number][];
	queryRole: string | undefined;
	realSpawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
	spawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
	tell: ((line: string) => void) | undefined;
}

export const createPostgres = Effect.gen(function* () {
	const realSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const environment: PostgresEngine["environment"] = { "DOCKER_HOST": "unix:///var/run/docker.sock" };
	const engine: PostgresEngine = {
		appDatabase: undefined,
		calls: [],
		environment,
		failure: undefined,
		hostPsql: false,
		manager: localPostgres(environment, { delayMillis: 0 }),
		mode: "scripted",
		outcome: undefined,
		plan: [],
		queryRole: undefined,
		realSpawner,
		spawner: realSpawner,
		tell: undefined,
	};
	return engine;
});

export function usingCli<A, E, R>(engine: PostgresEngine, effect: Effect.Effect<A, E, R>) {
	return Effect.provideService(effect, ChildProcessSpawner.ChildProcessSpawner, engine.spawner);
}

export function connectCli(engine: PostgresEngine) {
	const script = dockerScript(engine.plan);
	engine.spawner = ChildProcessSpawner.make(
		Effect.fn("PostgresEngine.spawn")(function* (command) {
			if (command._tag !== "StandardCommand") {
				return yield* Effect.die(new Error("The local setup kit expects a single command"));
			}
			const { command: file, args } = command;
			engine.calls.push([file, ...args]);
			if (file === "psql" && !engine.hostPsql) {
				return yield* PlatformError.systemError({
					_tag: "NotFound",
					method: "spawn",
					module: "ChildProcess",
					pathOrDescriptor: "psql",
				});
			}
			if (engine.mode === "real") {
				return yield* engine.realSpawner.spawn(file === "psql" && engine.hostClient ? engine.hostClient(command) : command);
			}
			engine.tell?.(`Docker ${args.join(" ")}`);
			const result = yield* Effect.sync(() => {
				if (file !== "docker") {
					throw new Error(`Unexpected executable: ${file}`);
				}
				return script.run(args);
			});
			return scriptedProcess(result);
		}),
	);
}

export function configureReadiness(engine: PostgresEngine, options: ReadinessOptions) {
	engine.manager = localPostgres(engine.environment, options);
}

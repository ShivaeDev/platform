import process from "node:process";
import { fileURLToPath } from "node:url";
import { Deferred, Effect, Fiber, Option, Redacted, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

export const deployChild = Effect.fn("Test.deployChild")(function* (
	kind: "worker" | "web" | "migrate",
	url: Redacted.Redacted<string>,
	port = 0,
	env: Record<string, string> = {},
) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const target = new URL(Redacted.value(url));
	target.searchParams.set("application_name", `deploy_${kind}`);
	const entry = kind === "migrate" ? "../server/migrate.ts" : "./deployApplication.ts";
	const preload = fileURLToPath(new URL("./moduleLoads.ts", import.meta.url));
	const child = yield* spawner.spawn(
		ChildProcess.make(process.execPath, ["--conditions=source", "--import", preload, fileURLToPath(new URL(entry, import.meta.url)), kind], {
			additionalFds: { fd3: { type: "output" } },
			env: {
				"DATABASE_URL": target.toString(),
				...env,
				...(kind === "web" ? { "BETTER_AUTH_SECRET": "app-test-secret-with-at-least-32-characters", "PORT": String(port) } : {}),
			},
			extendEnv: false,
		}),
	);
	const started = yield* Deferred.make<string, Error>();
	const waitingForSchema = yield* Deferred.make<void, Error>();
	const paused = yield* Deferred.make<void, Error>();
	const resumed = yield* Deferred.make<void, Error>();
	const logs: string[] = [];
	const errors: string[] = [];
	const output = yield* child.stdout.pipe(
		Stream.decodeText(),
		Stream.splitLines,
		Stream.runForEach((line) =>
			Effect.gen(function* () {
				logs.push(line);
				if (line.includes("Workers paused")) {
					yield* Deferred.succeed(paused, undefined);
				}
				if (line.includes("Workers resumed")) {
					yield* Deferred.succeed(resumed, undefined);
				}
				if (line.includes("Waiting for database migrations")) {
					yield* Deferred.succeed(waitingForSchema, undefined);
				}
				if (line.includes("Worker ready to take jobs")) {
					yield* Deferred.succeed(started, "worker");
				}
			}),
		),
		Effect.forkScoped,
	);
	const diagnostics = yield* child.stderr.pipe(
		Stream.decodeText(),
		Stream.splitLines,
		Stream.runForEach((line) => Effect.sync(() => errors.push(line))),
		Effect.forkScoped,
	);
	const exited = Effect.all([child.exitCode, Fiber.join(output), Fiber.join(diagnostics)], { concurrency: "unbounded" });
	const failedToStart = exited.pipe(
		Effect.andThen(Effect.suspend(() => Effect.fail(new Error(`${kind} exited before starting\n${[...logs, ...errors].join("\n")}`)))),
	);
	const listening = child.getOutputFd(3).pipe(
		Stream.decodeText(),
		Stream.splitLines,
		Stream.runHead,
		Effect.flatMap((address) => (Option.isSome(address) ? Effect.succeed(address.value) : failedToStart)),
	);
	return {
		child,
		errors,
		exitCode: exited.pipe(Effect.map(([code]) => Number(code))),
		logs,
		paused: Deferred.await(paused).pipe(Effect.timeout("20 seconds")),
		ready: Effect.raceFirst(kind === "web" ? listening : Deferred.await(started), failedToStart).pipe(Effect.timeout("20 seconds")),
		resumed: Deferred.await(resumed).pipe(Effect.timeout("20 seconds")),
		waitingForSchema: Effect.raceFirst(Deferred.await(waitingForSchema), failedToStart).pipe(Effect.timeout("20 seconds")),
	};
});

import { createServer } from "node:net";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Deferred, Effect, Redacted, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { eventually } from "@shivaedev/test/eventually.ts";

export async function deployPort() {
	const server = createServer();
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("Expected a TCP address");
	}
	await new Promise<void>((resolve) => server.close(() => resolve()));
	return address.port;
}

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
	const listenPort = kind === "web" && port === 0 ? yield* Effect.promise(deployPort) : port;
	const address = `http://127.0.0.1:${listenPort}`;
	const preload = fileURLToPath(new URL("./moduleLoads.ts", import.meta.url));
	const child = yield* spawner.spawn(
		ChildProcess.make(process.execPath, ["--conditions=source", "--import", preload, fileURLToPath(new URL(entry, import.meta.url)), kind], {
			env: {
				"DATABASE_URL": target.toString(),
				...env,
				...(kind === "web" ? { "BETTER_AUTH_SECRET": "app-test-secret-with-at-least-32-characters", "PORT": String(listenPort) } : {}),
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
	yield* child.stdout.pipe(
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
		Effect.ensuring(Effect.suspend(() => Deferred.fail(started, new Error(`${kind} exited before starting\n${[...logs, ...errors].join("\n")}`)))),
		Effect.ensuring(Deferred.fail(waitingForSchema, new Error(`${kind} exited before waiting for its schema`))),
		Effect.forkScoped,
	);
	yield* child.stderr.pipe(
		Stream.decodeText(),
		Stream.splitLines,
		Stream.runForEach((line) => Effect.sync(() => errors.push(line))),
		Effect.forkScoped,
	);
	const healthy = eventually(
		Effect.tryPromise(async (signal) => {
			const response = await fetch(`${address}/health`, { signal });
			await response.arrayBuffer();
			if (!response.ok) {
				throw new Error(`Health check returned HTTP ${response.status}`);
			}
			return address;
		}),
		{ interval: "100 millis" },
	);
	return {
		child,
		errors,
		logs,
		paused: Deferred.await(paused).pipe(Effect.timeout("20 seconds")),
		ready: (kind === "web" ? Effect.raceFirst(healthy, Deferred.await(started)) : Deferred.await(started)).pipe(Effect.timeout("20 seconds")),
		resumed: Deferred.await(resumed).pipe(Effect.timeout("20 seconds")),
		url: address,
		waitingForSchema: Deferred.await(waitingForSchema).pipe(Effect.timeout("20 seconds")),
	};
});

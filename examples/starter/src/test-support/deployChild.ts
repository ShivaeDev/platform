import { createServer } from "node:net";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Deferred, Effect, Redacted, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

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

export const deployChild = Effect.fn("Test.deployChild")(function* (kind: "worker" | "web" | "migrate", url: Redacted.Redacted<string>, port = 0) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const target = new URL(Redacted.value(url));
	target.searchParams.set("application_name", `deploy_${kind}`);
	const entry = kind === "migrate" ? "../server/migrate.ts" : "./deployProcess.ts";
	const child = yield* spawner.spawn(
		ChildProcess.make(process.execPath, ["--conditions=source", fileURLToPath(new URL(entry, import.meta.url)), kind], {
			env: {
				"DATABASE_URL": target.toString(),
				...(kind === "web" ? { "BETTER_AUTH_SECRET": "app-test-secret-with-at-least-32-characters", "PORT": String(port) } : {}),
			},
			extendEnv: false,
		}),
	);
	const started = yield* Deferred.make<string, Error>();
	const logs: string[] = [];
	const errors: string[] = [];
	yield* child.stdout.pipe(
		Stream.decodeText(),
		Stream.splitLines,
		Stream.runForEach((line) =>
			Effect.gen(function* () {
				logs.push(line);
				if (line.startsWith("DEPLOY_READY ")) {
					yield* Deferred.succeed(started, line.slice("DEPLOY_READY ".length));
				}
			}),
		),
		Effect.ensuring(Deferred.fail(started, new Error(`${kind} exited before starting`))),
		Effect.forkScoped,
	);
	yield* child.stderr.pipe(
		Stream.decodeText(),
		Stream.splitLines,
		Stream.runForEach((line) => Effect.sync(() => errors.push(line))),
		Effect.forkScoped,
	);
	return { child, errors, logs, ready: Deferred.await(started).pipe(Effect.timeout("20 seconds")), url: `http://127.0.0.1:${port}` };
});

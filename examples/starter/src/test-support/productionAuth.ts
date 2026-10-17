import process from "node:process";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { Deferred, Effect, Redacted, Stream } from "effect";
import { ChildProcess } from "effect/process";

export const productionAuth = Effect.fn("Test.productionAuth")(function* (databaseUrl: Redacted.Redacted<string>, trustedProxy?: string) {
	let output = "";
	const ready = yield* Deferred.make<string>();
	const child = yield* ChildProcess.make(
		process.execPath,
		[
			...(import.meta.resolve("@shivaedev/platform/appHost.ts").endsWith(".ts") ? ["--conditions=source"] : []),
			fileURLToPath(new URL("./productionHost.ts", import.meta.url)),
		],
		{
			env: {
				"BETTER_AUTH_SECRET": "app-test-secret-with-at-least-32-characters",
				"DATABASE_URL": Redacted.value(databaseUrl),
				"NODE_ENV": "production",
				"PUBLIC_URL": "https://app.example",
				"TEST": "false",
				"TRUSTED_PROXY": trustedProxy,
			},
			extendEnv: true,
		},
	);
	yield* child.all.pipe(
		Stream.decodeText(),
		Stream.runForEach((text) =>
			Effect.gen(function* () {
				output += text;
				const url = /AUTH_URL=(?<url>http:\/\/127\.0\.0\.1:\d+)\n/u.exec(output)?.groups?.url;
				if (url !== undefined) {
					yield* Deferred.succeed(ready, url);
				}
			}),
		),
		Effect.forkScoped,
	);
	const url = yield* Deferred.await(ready).pipe(
		Effect.raceFirst(child.exitCode.pipe(Effect.flatMap((code) => Effect.die(new Error(`Production host exited (${code}): ${output}`))))),
		Effect.timeout("20 seconds"),
	);
	return { output: () => output, url };
}, Effect.provide(NodeServices.layer));

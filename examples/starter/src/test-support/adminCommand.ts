import process from "node:process";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { Effect, Fiber, Redacted, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { secret } from "./host.ts";

export const adminCommand = Effect.fn("AdminSetup.adminCommand")(function* (email: string, password: string) {
	const database = yield* PostgresTestDatabase;
	return yield* Effect.gen(function* () {
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		const child = yield* spawner.spawn(
			ChildProcess.make(process.execPath, ["--conditions=source", fileURLToPath(new URL("../server/admin.ts", import.meta.url))], {
				env: {
					"ADMIN_EMAIL": email,
					"ADMIN_PASSWORD": password,
					"BETTER_AUTH_SECRET": Redacted.value(secret),
					"DATABASE_URL": Redacted.value(database.url),
				},
				extendEnv: false,
			}),
		);
		const output = yield* child.stdout.pipe(Stream.decodeText(), Stream.runCollect, Effect.forkScoped);
		const errors = yield* child.stderr.pipe(Stream.decodeText(), Stream.runCollect, Effect.forkScoped);
		const code = yield* child.exitCode;
		return { code, errors: (yield* Fiber.join(errors)).join(""), output: (yield* Fiber.join(output)).join("") };
	}).pipe(Effect.provide(NodeServices.layer));
});

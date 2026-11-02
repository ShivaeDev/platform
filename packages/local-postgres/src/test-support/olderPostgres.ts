import { Effect } from "effect";
import { ChildProcess } from "effect/process";
import { runCommand } from "#runCommand.ts";
import { containerReady } from "#test/containerReady.ts";
import { postgres } from "#test/postgres.ts";

export const olderPostgres = postgres.trait(
	"machine",
	"a private PostgreSQL 17 container answers host psql, and Docker runs no other command",
	function* (engine) {
		const container = yield* Effect.acquireRelease(
			runCommand("docker", ["run", "--detach", "--rm", "--env", "POSTGRES_PASSWORD=postgres", "postgres:17-alpine"]),
			(id) => runCommand("docker", ["rm", "--force", id]).pipe(Effect.orDie),
		);
		yield* containerReady(container);
		engine.hostPsql = true;
		engine.mode = "real";
		engine.hostClient = (command) => {
			const redirected = [...command.args];
			const index = redirected.indexOf("--dbname") + 1;
			const url = new URL(String(redirected[index]));
			url.port = "5432";
			redirected[index] = url.toString();
			return ChildProcess.make("docker", ["exec", container, "psql", ...redirected], command.options);
		};
	},
);

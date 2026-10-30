import { Effect, Schedule } from "effect";
import { postgres } from "#test/postgres.ts";

export const olderPostgres = postgres.trait(
	"machine",
	"a private PostgreSQL 17 container answers host psql, and Docker runs no other command",
	function* (engine) {
		function run(args: readonly string[]) {
			return engine.realExec("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
		}
		const container = yield* Effect.acquireRelease(
			Effect.sync(() => run(["run", "--detach", "--rm", "--env", "POSTGRES_PASSWORD=postgres", "postgres:17-alpine"])),
			(id) => Effect.sync(() => run(["rm", "--force", id])),
		);
		// The image publishes no readiness event, so the trait asks pg_isready until the server accepts connections.
		yield* Effect.try(() => run(["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"])).pipe(
			Effect.retry({ schedule: Schedule.spaced("100 millis"), times: 100 }),
		);
		engine.hostPsql = true;
		const exec = engine.realExec;
		engine.hostClient = (args, options) => {
			const redirected = [...args];
			const index = redirected.indexOf("--dbname") + 1;
			const url = new URL(String(redirected[index]));
			url.port = "5432";
			redirected[index] = url.toString();
			return exec("docker", ["exec", container, "psql", ...redirected], options);
		};
	},
);

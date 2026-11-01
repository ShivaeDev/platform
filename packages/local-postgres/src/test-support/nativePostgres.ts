import { Effect, PlatformError, Schedule } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { runCommand } from "#runCommand.ts";
import { postgres } from "#test/postgres.ts";
import { scriptedProcess } from "#test/scriptedProcess.ts";

export function nativePostgres({ dockerAvailable }: { readonly dockerAvailable: boolean }) {
	return postgres.trait(
		"machine",
		`PostgreSQL 18.6 with a distribution suffix and 100 connections answers host psql; ${dockerAvailable ? "Docker has no managed container on port 55432" : "Docker is not installed"}`,
		function* (engine) {
			const container = yield* Effect.acquireRelease(
				runCommand("docker", ["run", "--detach", "--rm", "--env", "POSTGRES_PASSWORD=postgres", "postgres:18.6"]),
				(id) => runCommand("docker", ["rm", "--force", id]).pipe(Effect.orDie),
			);
			// The private server supplies real PostgreSQL; only the host's executable boundary is redirected.
			yield* runCommand("docker", ["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]).pipe(
				Effect.retry({ schedule: Schedule.spaced("100 millis"), times: 100 }),
			);
			engine.hostPsql = true;
			engine.mode = "real";
			engine.hostClient = (command) => {
				const args = [...command.args];
				const index = args.indexOf("--dbname") + 1;
				const url = new URL(String(args[index]));
				url.port = "5432";
				args[index] = url.toString();
				return ChildProcess.make("docker", ["exec", "--env", "PGPASSWORD", container, "psql", ...args], command.options);
			};
			const real = engine.realSpawner;
			engine.realSpawner = ChildProcessSpawner.make((command) => {
				if (command._tag === "StandardCommand" && command.command === "docker" && command.args[0] === "exec") {
					return real.spawn(command);
				}
				if (dockerAvailable && command._tag === "StandardCommand" && command.command === "docker" && command.args[0] === "ps") {
					return Effect.succeed(scriptedProcess(""));
				}
				return Effect.fail(PlatformError.systemError({ _tag: "NotFound", method: "spawn", module: "ChildProcess", pathOrDescriptor: "docker" }));
			});
		},
	);
}

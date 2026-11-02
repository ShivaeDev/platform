import { isDeepStrictEqual } from "node:util";
import { Effect, PlatformError } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { runCommand } from "#runCommand.ts";
import { containerReady } from "#test/containerReady.ts";
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
			yield* containerReady(container);
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
				if (
					command._tag === "StandardCommand"
					&& command.command === "docker"
					&& isDeepStrictEqual(command.args, ["ps", "--filter", "name=^/development-postgres$", "--filter", "publish=55432", "--format", "{{.ID}}"])
				) {
					return dockerAvailable
						? Effect.succeed(scriptedProcess(""))
						: Effect.fail(PlatformError.systemError({ _tag: "NotFound", method: "spawn", module: "ChildProcess", pathOrDescriptor: "docker" }));
				}
				return Effect.die(new Error(`Unexpected native PostgreSQL command: ${JSON.stringify(command)}`));
			});
		},
	);
}

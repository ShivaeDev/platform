import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { scriptedProcess } from "#test/scriptedProcess.ts";

export function connectionBoundary(name: string, real: ChildProcessSpawner.ChildProcessSpawner["Service"]) {
	const faults: { at: "restart" | "confirmation" | undefined; restarted: boolean } = { at: undefined, restarted: false };
	// Give the fixed shared-container boundary a disposable name, volume and port.
	function redirected(args: readonly string[]) {
		return args.map((arg) => {
			if (arg === "development-postgres") {
				return name;
			}
			if (arg === "publish=55432" || arg === "name=^/development-postgres$") {
				return `name=^/${name}$`;
			}
			if (arg === "127.0.0.1:55432:5432") {
				return "127.0.0.1::5432";
			}
			if (arg === "type=volume,src=development-postgres,dst=/var/lib/postgresql") {
				return `type=volume,src=${name},dst=/var/lib/postgresql`;
			}
			return arg;
		});
	}
	const spawner = ChildProcessSpawner.make((command) => {
		if (command._tag !== "StandardCommand") {
			return Effect.die(new Error("The connection kit expects a single command"));
		}
		// Fail only the external command; setup and its typed error handling still run.
		if (command.command === "docker" && command.args[0] === "restart") {
			if (faults.at === "restart") {
				return Effect.succeed(scriptedProcess(new Error("Docker refused to restart the container")));
			}
			faults.restarted = true;
		}
		if (command.command !== "psql") {
			return real.spawn(ChildProcess.make(command.command, redirected(command.args), command.options));
		}
		if (faults.at === "confirmation" && faults.restarted && command.args.includes("SHOW max_connections")) {
			return Effect.succeed(scriptedProcess(new Error("PostgreSQL refused the connection-limit check")));
		}
		const client = [...command.args];
		const index = client.indexOf("--dbname") + 1;
		const url = new URL(client[index] ?? "");
		url.port = "5432";
		client[index] = url.toString();
		return real.spawn(ChildProcess.make("docker", ["exec", "--env", "PGPASSWORD", name, "psql", ...client], command.options));
	});
	return { faults, redirected, spawner };
}

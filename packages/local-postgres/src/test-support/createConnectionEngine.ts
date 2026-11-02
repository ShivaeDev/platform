import { randomUUID } from "node:crypto";
import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { POSTGRES_IMAGE, startContainer } from "#localContainer.ts";
import { LOCAL_SERVER, localPostgres } from "#localPostgres.ts";
import { type CommandOptions, runCommand } from "#runCommand.ts";
import { containerReady } from "#test/containerReady.ts";

export interface ContainerState {
	readonly id: string;
	readonly startedAt: string;
}

export type ConnectionEngine = Effect.Success<ReturnType<typeof createConnectionEngine>>;

export const createConnectionEngine = Effect.fn("ConnectionEngine.createConnectionEngine")(function* () {
	const real = yield* ChildProcessSpawner.ChildProcessSpawner;
	const name = `local-postgres-story-${randomUUID()}`;
	function direct(args: readonly string[], options?: CommandOptions) {
		return runCommand("docker", args, options);
	}
	// Give the fixed shared-container boundary a disposable name, volume and port.
	function redirected(args: readonly string[]) {
		return args.map((arg) => {
			if (arg === "development-postgres") {
				return name;
			}
			if (arg === "publish=55432") {
				return `name=^/${name}$`;
			}
			if (arg === "name=^/development-postgres$") {
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
	function docker(args: readonly string[], options?: CommandOptions) {
		return direct(redirected(args), options);
	}
	const spawner = ChildProcessSpawner.make((command) => {
		if (command._tag !== "StandardCommand") {
			return Effect.die(new Error("The connection kit expects a single command"));
		}
		if (command.command !== "psql") {
			return real.spawn(ChildProcess.make(command.command, redirected(command.args), command.options));
		}
		const client = [...command.args];
		const index = client.indexOf("--dbname") + 1;
		const url = new URL(client[index] ?? "");
		url.port = "5432";
		client[index] = url.toString();
		return real.spawn(ChildProcess.make("docker", ["exec", "--env", "PGPASSWORD", name, "psql", ...client], command.options));
	});
	const manager = localPostgres({ "DOCKER_HOST": "unix:///var/run/docker.sock" }, { attempts: 60, delayMillis: 100 });
	function sql(query: string) {
		return manager.sql(`${LOCAL_SERVER}/postgres`, query).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner));
	}
	const state = Effect.fn("ConnectionEngine.state")(function* () {
		if (!(yield* docker(["ps", "-aq", "--filter", `name=^/${name}$`]))) {
			return undefined;
		}
		const [id = "", startedAt = ""] = (yield* docker(["inspect", "--format", "{{.Id}} {{.State.StartedAt}}", name])).split(" ");
		return { id, startedAt };
	});
	const mutable: { before: ContainerState | undefined; connection: string | undefined; outcome: string | undefined } = {
		before: undefined,
		connection: undefined,
		outcome: undefined,
	};
	yield* Effect.addFinalizer(() =>
		Effect.gen(function* () {
			if (yield* docker(["ps", "-aq", "--filter", `name=^/${name}$`])) {
				yield* docker(["rm", "--force", name]);
			}
			if (yield* docker(["volume", "ls", "-q", "--filter", `name=^${name}$`])) {
				yield* docker(["volume", "rm", name]);
			}
		}).pipe(Effect.orDie),
	);
	return {
		...mutable,
		docker,
		name,
		sql,
		start: (connection?: string) => manager.startPostgres(connection).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)),
		startStock: () => Effect.andThen(startContainer(docker), () => containerReady(name)),
		startUnpinned: Effect.fn("ConnectionEngine.startUnpinned")(function* () {
			const image = yield* direct(["image", "inspect", "--format", "{{.Id}}", POSTGRES_IMAGE]);
			yield* direct([
				"run",
				"--detach",
				"--name",
				name,
				"--publish",
				"127.0.0.1::5432",
				"--env",
				"POSTGRES_PASSWORD=postgres",
				"--mount",
				`type=volume,src=${name},dst=/var/lib/postgresql`,
				image,
			]);
			yield* containerReady(name);
		}),
		state,
	};
});

import { randomUUID } from "node:crypto";
import { Effect, Schedule } from "effect";
import { ChildProcessSpawner } from "effect/process";
import { POSTGRES_IMAGE, startContainer } from "#localContainer.ts";
import { LOCAL_SERVER, localPostgres } from "#localPostgres.ts";
import { type CommandOptions, runCommand } from "#runCommand.ts";
import { connectionBoundary } from "#test/connectionBoundary.ts";

export interface ContainerState {
	readonly id: string;
	readonly startedAt: string;
}

export type ConnectionEngine = Effect.Success<ReturnType<typeof createConnectionEngine>>;

export const createConnectionEngine = Effect.fn("ConnectionEngine.createConnectionEngine")(function* () {
	const real = yield* ChildProcessSpawner.ChildProcessSpawner;
	const name = `local-postgres-story-${randomUUID()}`;
	const { faults, redirected, spawner } = connectionBoundary(name, real);
	function direct(args: readonly string[], options?: CommandOptions) {
		return runCommand("docker", args, options);
	}
	function docker(args: readonly string[], options?: CommandOptions) {
		return direct(redirected(args), options);
	}
	const manager = localPostgres({ "DOCKER_HOST": "unix:///var/run/docker.sock" }, { attempts: 60, delayMillis: 100 });
	function sql(query: string) {
		return manager.sql(`${LOCAL_SERVER}/postgres`, query).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner));
	}
	// A restarted container publishes no readiness event, so the kit asks until PostgreSQL accepts a query.
	function wait() {
		return sql("SELECT 1").pipe(Effect.retry({ schedule: Schedule.spaced("100 millis"), times: 60 }));
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
		faults,
		name,
		sql,
		start: (connection?: string) => manager.startPostgres(connection).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)),
		startStock: () => Effect.andThen(startContainer(docker), wait),
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
			yield* wait();
		}),
		state,
		wait,
	};
});

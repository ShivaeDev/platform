import { Effect, Redacted, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { postgresLayer } from "@shivaedev/sql/postgresLayer.ts";

export const DATA_DIRECTORY = "/var/lib/postgresql/18/docker";

export const command = Effect.fnUntraced(function* (file: string, args: readonly string[]) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	return yield* Effect.scoped(
		Effect.gen(function* () {
			const child = yield* spawner.spawn(ChildProcess.make(file, args));
			const [output, error, code] = yield* Effect.all(
				[Stream.mkString(Stream.decodeText(child.stdout)), Stream.mkString(Stream.decodeText(child.stderr)), child.exitCode],
				{ concurrency: "unbounded" },
			);
			if (code !== 0) {
				return yield* Effect.die(`${file} exited ${code}: ${error}`);
			}
			return output.trim();
		}),
	);
});

export function ready(container: string) {
	return Effect.scoped(
		Effect.gen(function* () {
			const since = yield* command("docker", ["inspect", "--format", "{{.State.StartedAt}}", container]);
			const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
			const events = yield* spawner.spawn(
				ChildProcess.make("docker", [
					"events",
					"--since",
					since,
					"--filter",
					`container=${container}`,
					"--filter",
					"event=health_status",
					"--format",
					"{{.Action}}",
				]),
			);
			yield* events.stdout.pipe(
				Stream.decodeText(),
				Stream.splitLines,
				Stream.filter((line) => line === "health_status: healthy"),
				Stream.take(1),
				Stream.runDrain,
			);
		}),
	);
}

export const machine = Effect.gen(function* () {
	const container = yield* command("docker", [
		"run",
		"-d",
		"--memory=1g",
		"--cpus=2",
		"-e",
		"POSTGRES_HOST_AUTH_METHOD=trust",
		"-p",
		"127.0.0.1::5432",
		"--health-cmd=pg_isready -h 127.0.0.1 -U postgres",
		"--health-interval=1s",
		"--health-start-period=30s",
		"--health-start-interval=1s",
		"postgres:18.6-bookworm",
	]);
	yield* Effect.addFinalizer(() => command("docker", ["rm", "-fv", container]).pipe(Effect.asVoid, Effect.orDie));
	yield* ready(container);
	const connection = yield* connect(container);
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const inContainer = ChildProcessSpawner.make((child) => {
		if (child._tag !== "StandardCommand") {
			return Effect.die("The trim uses one command");
		}
		return spawner.spawn(
			ChildProcess.make("docker", ["exec", "--user", "postgres", container, child.command, ...child.args], {
				stderr: "inherit",
				stdout: "ignore",
			}),
		);
	});
	return { container, inContainer, ...connection };
});

export type Machine = Effect.Success<typeof machine>;

export function cgroupMemory(container: string) {
	return command("docker", ["exec", container, "cat", "/sys/fs/cgroup/memory.current"]).pipe(Effect.map(Number));
}

export const connect = Effect.fnUntraced(function* (container: string) {
	const port = yield* command("docker", ["port", container, "5432"]);
	const url = Redacted.make(`postgresql://postgres@${port}/postgres`);
	return { layer: postgresLayer(url, { maxConnections: 1 }), url };
});

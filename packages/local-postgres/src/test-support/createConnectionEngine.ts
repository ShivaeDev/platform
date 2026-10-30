import { type ExecFileSyncOptionsWithStringEncoding, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Effect } from "effect";
import { vi } from "vitest";
import { POSTGRES_IMAGE, startContainer } from "#localContainer.ts";
import { LOCAL_SERVER, localPostgres } from "#localPostgres.ts";

vi.mock("node:child_process", async (original) => {
	const module = await original<typeof import("node:child_process")>();
	return { ...module, execFileSync: vi.fn(module.execFileSync) };
});

export interface ContainerState {
	readonly id: string;
	readonly startedAt: string;
}

export interface ConnectionEngine {
	before: ContainerState | undefined;
	connection: string | undefined;
	readonly docker: (args: readonly string[]) => string;
	readonly manager: ReturnType<typeof localPostgres>;
	readonly name: string;
	outcome: string | undefined;
	readonly sql: (query: string) => string;
	readonly startStock: () => void;
	readonly startUnpinned: () => void;
	readonly state: () => ContainerState | undefined;
	readonly wait: () => void;
}

export function createConnectionEngine() {
	return Effect.acquireRelease(
		Effect.promise(async (): Promise<ConnectionEngine> => {
			const real = await vi.importActual<typeof import("node:child_process")>("node:child_process");
			const name = `local-postgres-story-${randomUUID()}`;
			const options: ExecFileSyncOptionsWithStringEncoding = { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] };
			function direct(args: readonly string[], settings: ExecFileSyncOptionsWithStringEncoding = options) {
				return real.execFileSync("docker", args, settings).trim();
			}
			// Give the fixed shared-container boundary a disposable name, volume and port.
			function docker(args: readonly string[], settings: ExecFileSyncOptionsWithStringEncoding = options) {
				return direct(
					args.map((arg) => {
						if (arg === "development-postgres") {
							return name;
						}
						if (arg === "127.0.0.1:55432:5432") {
							return "127.0.0.1::5432";
						}
						if (arg === "type=volume,src=development-postgres,dst=/var/lib/postgresql") {
							return `type=volume,src=${name},dst=/var/lib/postgresql`;
						}
						return arg;
					}),
					settings,
				);
			}
			const manager = localPostgres({ "DOCKER_HOST": "unix:///var/run/docker.sock" }, { attempts: 60, delayMillis: 100 });
			vi.mocked(execFileSync).mockImplementation((file, args, settings) => {
				if (file !== "psql") {
					return docker(args ?? [], { stdio: ["ignore", "pipe", "pipe"], ...settings, encoding: "utf8" });
				}
				const client = [...(args ?? [])];
				const index = client.indexOf("--dbname") + 1;
				const url = new URL(client[index] ?? "");
				url.port = "5432";
				client[index] = url.toString();
				return direct(["exec", "--env", "PGPASSWORD", name, "psql", ...client], { ...settings, encoding: "utf8" });
			});
			function sql(query: string) {
				return manager.sql(`${LOCAL_SERVER}/postgres`, query);
			}
			// A restarted container publishes no readiness event, so the kit asks until PostgreSQL accepts a query.
			function wait() {
				let failure: unknown;
				for (let attempt = 0; attempt < 60; attempt += 1) {
					try {
						sql("SELECT 1");
						return;
					} catch (error) {
						failure = error;
						Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
					}
				}
				throw failure;
			}
			function state(): ContainerState | undefined {
				try {
					const [id = "", startedAt = ""] = docker(["inspect", "--format", "{{.Id}} {{.State.StartedAt}}", name]).split(" ");
					return { id, startedAt };
				} catch {
					return undefined;
				}
			}
			return {
				before: undefined,
				connection: undefined,
				docker,
				manager,
				name,
				outcome: undefined,
				sql,
				startStock: () => {
					startContainer(docker);
					wait();
				},
				startUnpinned: () => {
					const image = direct(["image", "inspect", "--format", "{{.Id}}", POSTGRES_IMAGE]);
					direct([
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
					wait();
				},
				state,
				wait,
			};
		}),
		(engine) =>
			Effect.sync(() => {
				try {
					if (engine.docker(["ps", "-aq", "--filter", `name=^/${engine.name}$`])) {
						engine.docker(["rm", "--force", engine.name]);
					}
					if (engine.docker(["volume", "ls", "-q", "--filter", `name=^${engine.name}$`])) {
						engine.docker(["volume", "rm", engine.name]);
					}
				} finally {
					vi.mocked(execFileSync).mockReset();
				}
			}),
	);
}

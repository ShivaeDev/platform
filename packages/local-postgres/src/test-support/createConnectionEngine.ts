import { type ExecFileSyncOptionsWithStringEncoding, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Effect } from "effect";
import { vi } from "vitest";
import { startContainer } from "#localContainer.ts";
import { LOCAL_SERVER, localPostgres } from "#localPostgres.ts";

vi.mock("node:child_process", async (original) => {
	const module = await original<typeof import("node:child_process")>();
	return { ...module, execFileSync: vi.fn(module.execFileSync) };
});

export function createConnectionEngine() {
	return Effect.acquireRelease(
		Effect.promise(async () => {
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
					return docker(args ?? [], { ...settings, encoding: "utf8" });
				}
				const client = [...(args ?? [])];
				const index = client.indexOf("--dbname") + 1;
				const url = new URL(client[index] ?? "");
				url.port = "5432";
				client[index] = url.toString();
				return direct(["exec", "--env", "PGPASSWORD", name, "psql", ...client], { ...settings, encoding: "utf8" });
			});
			function wait() {
				let failure: unknown;
				for (let attempt = 0; attempt < 60; attempt += 1) {
					try {
						manager.sql("postgresql://postgres:postgres@127.0.0.1:55432/postgres", "SELECT 1");
						return;
					} catch (error) {
						failure = error;
						Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
					}
				}
				throw failure;
			}
			return {
				docker,
				manager,
				name,
				server: LOCAL_SERVER,
				startStock: () => {
					startContainer(docker);
					wait();
				},
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

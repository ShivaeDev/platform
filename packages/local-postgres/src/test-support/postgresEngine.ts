import type { ExecFileSyncOptions } from "node:child_process";
import { execFileSync } from "node:child_process";
import { Effect } from "effect";
import { vi } from "vitest";
import { LOCAL_SERVER, localPostgres } from "#localPostgres.ts";
import { dockerScript } from "#test/dockerScript.ts";

// Production modules bind execFileSync when they first load, so kit modules load them only after this module.
vi.mock("node:child_process", async (original) => {
	const module = await original<typeof import("node:child_process")>();
	return { ...module, execFileSync: vi.fn(module.execFileSync) };
});

export function databaseUrl(name: string) {
	return `${LOCAL_SERVER}/${name}`;
}

export const SERVER = databaseUrl("postgres");

export interface PostgresEngine {
	appDatabase: string | undefined;
	calls: (readonly string[])[];
	contextEndpoint: string;
	environment: { "DOCKER_CONTEXT"?: string | undefined; "DOCKER_HOST"?: string | undefined };
	failure: unknown;
	hostClient?: (args: readonly string[], options: ExecFileSyncOptions) => ReturnType<typeof execFileSync>;
	hostPsql: boolean;
	manager: ReturnType<typeof localPostgres>;
	mode: "scripted" | "real";
	outcome: string | undefined;
	plan: Parameters<typeof dockerScript>[0][number][];
	queryRole: string | undefined;
	realExec: typeof execFileSync;
	tell: ((line: string) => void) | undefined;
}

export function createPostgres() {
	return Effect.acquireRelease(
		Effect.promise(async (): Promise<PostgresEngine> => {
			const real = await vi.importActual<typeof import("node:child_process")>("node:child_process");
			const environment: PostgresEngine["environment"] = { "DOCKER_HOST": "unix:///var/run/docker.sock" };
			return {
				appDatabase: undefined,
				calls: [],
				contextEndpoint: "unix:///var/run/docker.sock",
				environment,
				failure: undefined,
				hostPsql: false,
				manager: localPostgres(environment, { delayMillis: 0 }),
				mode: "scripted",
				outcome: undefined,
				plan: [],
				queryRole: undefined,
				realExec: real.execFileSync,
				tell: undefined,
			};
		}),
		() => Effect.sync(() => vi.mocked(execFileSync).mockReset()),
	);
}

function missingPsql() {
	return Object.assign(new Error("spawnSync psql ENOENT"), { code: "ENOENT" });
}

// A scripted answer is a Buffer unless the call asks for text, as execFileSync's own answer is.
function answered(answer: string, options: ExecFileSyncOptions | undefined) {
	return options?.encoding === "utf8" ? answer : Buffer.from(answer);
}

export function connectCli(engine: PostgresEngine) {
	const script = dockerScript(engine.plan);
	vi.mocked(execFileSync).mockImplementation((file, args, options) => {
		const cli = args ?? [];
		engine.calls.push([file, ...cli]);
		if (file === "psql" && !engine.hostPsql) {
			throw missingPsql();
		}
		if (file === "psql" && engine.hostClient) {
			return engine.hostClient(cli, options ?? {});
		}
		if (engine.mode === "real") {
			return engine.realExec(file, cli, options);
		}
		engine.tell?.(`Docker ${cli.join(" ")}`);
		return answered(cli[0] === "context" ? engine.contextEndpoint : script.run(cli), options);
	});
}

export function configureReadiness(engine: PostgresEngine, attempts: number) {
	engine.manager = localPostgres(engine.environment, { attempts, delayMillis: 0 });
}

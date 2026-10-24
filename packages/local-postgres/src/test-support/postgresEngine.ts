import type { ExecFileSyncOptionsWithStringEncoding } from "node:child_process";
import { execFileSync } from "node:child_process";
import { Effect } from "effect";
import { vi } from "vitest";
import { localPostgres } from "#localPostgres.ts";
import { dockerReadiness } from "#test/dockerReadiness.ts";
import { dockerScript } from "#test/dockerScript.ts";

vi.mock("node:child_process", async (original) => {
	const module = await original<typeof import("node:child_process")>();
	return { ...module, execFileSync: vi.fn(module.execFileSync) };
});

export interface PostgresEngine {
	calls: string[][];
	contextEndpoint: string;
	encodings: (BufferEncoding | "buffer" | null | undefined)[];
	environment: { "DOCKER_CONTEXT"?: string | undefined; "DOCKER_HOST"?: string | undefined };
	hostClient?: (args: readonly string[], options: ExecFileSyncOptionsWithStringEncoding) => string;
	manager: ReturnType<typeof localPostgres>;
	mode: "script" | "real" | "readiness";
	plan: Parameters<typeof dockerScript>[0][number][];
	probes: number;
	ready: boolean;
	realExec: typeof execFileSync;
	script: ReturnType<typeof dockerScript> | undefined;
	startup: ReturnType<typeof dockerReadiness> | undefined;
	tell: ((line: string) => void) | undefined;
	unavailableProbes: number;
}

export function createPostgres() {
	return Effect.acquireRelease(
		Effect.promise(async (): Promise<PostgresEngine> => {
			const real = await vi.importActual<typeof import("node:child_process")>("node:child_process");
			const environment: PostgresEngine["environment"] = { "DOCKER_HOST": "unix:///var/run/docker.sock" };
			return {
				calls: [],
				contextEndpoint: "unix:///var/run/docker.sock",
				encodings: [],
				environment,
				manager: localPostgres(environment, { delayMillis: 0 }),
				mode: "script",
				plan: [],
				probes: 0,
				ready: false,
				realExec: real.execFileSync,
				script: undefined,
				startup: undefined,
				tell: undefined,
				unavailableProbes: 0,
			};
		}),
		() => Effect.sync(() => vi.mocked(execFileSync).mockReset()),
	);
}

export function connectCli(engine: PostgresEngine) {
	engine.script = engine.mode === "script" ? dockerScript(engine.plan) : undefined;
	engine.startup =
		engine.mode === "readiness" ? dockerReadiness(engine.unavailableProbes, engine.realExec, (line) => engine.tell?.(line)) : undefined;
	vi.mocked(execFileSync).mockImplementation((file, args, options) => {
		const cliArgs = args ?? [];
		engine.calls.push([file, ...cliArgs]);
		engine.encodings.push(options?.encoding);
		const strings = { ...options, encoding: "utf8" } as const;
		if (engine.mode === "real") {
			return realCommand(engine, file, cliArgs, strings);
		}
		if (engine.startup) {
			return engine.startup.run(file, cliArgs, strings);
		}
		if (file === "psql") {
			throw Object.assign(new Error("spawnSync psql ENOENT"), { code: "ENOENT" });
		}
		engine.tell?.(`Docker ${cliArgs.join(" ")}`);
		if (cliArgs[0] === "context") {
			return engine.contextEndpoint;
		}
		return engine.script?.run(cliArgs, strings) ?? "";
	});
}

export function configureReadiness(engine: PostgresEngine, attempts: number) {
	engine.manager = localPostgres(engine.environment, { attempts, delayMillis: 0 });
}

function realCommand(engine: PostgresEngine, file: string, args: readonly string[], options: ExecFileSyncOptionsWithStringEncoding) {
	return file === "psql" && engine.hostClient ? engine.hostClient(args, options) : engine.realExec(file, args, options);
}

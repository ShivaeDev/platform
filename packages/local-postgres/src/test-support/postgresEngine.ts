import { execFileSync } from "node:child_process";
import { Effect } from "effect";
import { expect, vi } from "vitest";
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
	environment: { "DOCKER_CONTEXT"?: string | undefined; "DOCKER_HOST"?: string | undefined };
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
		expect(options?.encoding).toBe("utf8");
		const strings = { ...options, encoding: "utf8" } as const;
		if (engine.mode === "real") {
			return engine.realExec(file, cliArgs, strings);
		}
		if (engine.startup) {
			return engine.startup.run(file, cliArgs, strings);
		}
		engine.calls.push([file, ...cliArgs]);
		if (file === "psql") {
			throw Object.assign(new Error("spawnSync psql ENOENT"), { code: "ENOENT" });
		}
		expect(file).toBe("docker");
		engine.tell?.(`Docker ${cliArgs.join(" ")}`);
		if (cliArgs[0] === "context") {
			expect(cliArgs).toEqual([
				"context",
				"inspect",
				...(engine.environment.DOCKER_CONTEXT ? [engine.environment.DOCKER_CONTEXT] : []),
				"--format",
				"{{.Endpoints.docker.Host}}",
			]);
			return engine.contextEndpoint;
		}
		return engine.script?.run(cliArgs, strings) ?? "";
	});
}

export function configureReadiness(engine: PostgresEngine, attempts: number) {
	engine.manager = localPostgres(engine.environment, { attempts, delayMillis: 0 });
}

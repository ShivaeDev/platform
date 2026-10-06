import type { ExecFileSyncOptions, ExecFileSyncOptionsWithStringEncoding, execFileSync } from "node:child_process";
import { expect } from "vitest";
import { dockerScript, PINNED_IMAGE } from "#test/dockerScript.ts";

export function dockerReadiness(unavailableProbes: number, realExec: typeof execFileSync) {
	const startup = dockerScript([
		{ args: ["info"], result: "Docker is available" },
		{ args: ["container", "inspect", "development-postgres"], result: "[]" },
		{ args: ["inspect", "--format", "{{.Config.Image}}", "development-postgres"], result: PINNED_IMAGE },
		{ args: ["start", "development-postgres"], result: "development-postgres" },
	]);
	function client(args: readonly string[], options: ExecFileSyncOptionsWithStringEncoding) {
		const id = realExec("docker", ["ps", "--filter", "publish=55432", "--format", "{{.ID}}"], { encoding: "utf8" }).trim();
		if (args[0] === "inspect") {
			expect(args).toEqual(["inspect", "--format", "{{.Config.Image}}", id]);
		} else {
			expect(args.slice(0, 9)).toEqual(["exec", id, "psql", "-X", "--set", "ON_ERROR_STOP=1", "-At", "-c", "SHOW server_version"]);
		}
		return realExec("docker", args, options);
	}
	let probes = 0;
	return {
		done(expectedProbes: number) {
			startup.done();
			expect(probes).toBe(expectedProbes);
		},
		run(file: string, args: readonly string[] = [], options: ExecFileSyncOptions = { encoding: "utf8" }) {
			expect(options.encoding).toBe("utf8");
			const stringOptions = { ...options, encoding: "utf8" } as const;
			if (file === "psql") {
				expect(args.slice(0, 6)).toEqual(["-X", "--set", "ON_ERROR_STOP=1", "-At", "-c", "SHOW server_version"]);
				throw Object.assign(new Error("spawnSync psql ENOENT"), { code: "ENOENT" });
			}
			expect(file).toBe("docker");
			if (args[0] === "context") {
				expect(args).toEqual(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
				return realExec(file, args, stringOptions);
			}
			if (args[0] === "ps") {
				expect(args).toEqual(["ps", "--filter", "publish=55432", "--format", "{{.ID}}"]);
				probes += 1;
				return probes <= unavailableProbes ? "" : realExec(file, args, stringOptions);
			}
			if (probes > unavailableProbes && ["inspect", "exec"].includes(args[0] ?? "")) {
				return client(args, stringOptions);
			}
			return startup.run(args, stringOptions);
		},
	};
}

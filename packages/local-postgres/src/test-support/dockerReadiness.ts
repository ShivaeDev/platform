import type { ExecFileSyncOptions, execFileSync } from "node:child_process";
import { dockerScript, PINNED_IMAGE } from "#test/dockerScript.ts";

export function dockerReadiness(unavailableProbes: number, realExec: typeof execFileSync, tell: (line: string) => void) {
	const startup = dockerScript([
		{ args: ["info"], result: "Docker is available" },
		{ args: ["container", "inspect", "development-postgres"], result: "[]" },
		{ args: ["inspect", "--format", "{{.Config.Image}}", "development-postgres"], result: PINNED_IMAGE },
		{ args: ["start", "development-postgres"], result: "development-postgres" },
	]);
	let probes = 0;
	return {
		probes: () => probes,
		run(file: string, args: readonly string[] = [], options: ExecFileSyncOptions = { encoding: "utf8" }) {
			const stringOptions = { ...options, encoding: "utf8" } as const;
			if (file === "psql") {
				throw Object.assign(new Error("spawnSync psql ENOENT"), { code: "ENOENT" });
			}
			if (args[0] === "context") {
				return realExec(file, args, stringOptions);
			}
			if (args[0] === "ps") {
				probes += 1;
				tell(`Docker discovery probe ${probes}`);
				return probes <= unavailableProbes ? "" : realExec(file, args, stringOptions);
			}
			if (probes > unavailableProbes && ["inspect", "exec"].includes(args[0] ?? "")) {
				return realExec(file, args, stringOptions);
			}
			tell(`Docker ${args.join(" ")}`);
			return startup.run(args, stringOptions);
		},
	};
}

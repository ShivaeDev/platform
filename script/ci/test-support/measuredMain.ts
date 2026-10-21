import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { planning } from "./planning.ts";

function measuredGithub(args: string[]) {
	if (args[1]?.includes("workflows/ci.yml")) {
		return JSON.stringify({
			"workflow_runs": [43, 42].map((id) => ({ conclusion: "success", event: "push", "head_branch": "main", "head_sha": `sha-${id}`, id })),
		});
	}
	if (args[0] === "api") {
		return JSON.stringify({ artifacts: [{ expired: false, id: args[1]?.includes("/43/") ? 4300 : 4200, name: args[1]?.split("name=")[1] }] });
	}
	const directory = args[args.indexOf("--dir") + 1] ?? "";
	const tests = args.includes("test-balancing");
	const runId = args[2] ?? "";
	mkdirSync(directory, { recursive: true });
	writeFileSync(
		join(directory, tests ? "test-durations.json" : "consumer-durations.json"),
		JSON.stringify({
			runId,
			sha: tests && runId === "43" ? "wrong" : `sha-${runId}`,
			shardCount: tests ? 3 : 5,
			timings: [{ durationMs: 10_000, name: "file" }],
		}),
	);
	return "";
}

export function measuredMain(mode: "available" | "denied" | "missing consumers" | "replaced" = "available") {
	return planning.trait("workspace", `main timings are ${mode}`, (engine) => {
		let identity = 0;
		engine.github = (args) => {
			if (mode === "denied") {
				throw new Error("denied");
			}
			if (args[0] !== "api" || !args[1]?.includes("/artifacts?")) {
				return measuredGithub(args);
			}
			if (mode === "missing consumers" && args[1].includes("name=consumer-balancing")) {
				return JSON.stringify({ artifacts: [] });
			}
			if (mode === "replaced") {
				identity += 1;
				return JSON.stringify({ artifacts: [{ expired: false, id: identity, name: args[1].split("name=")[1] }] });
			}
			return measuredGithub(args);
		};
	});
}

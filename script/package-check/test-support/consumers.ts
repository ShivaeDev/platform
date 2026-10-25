import { join } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { packArchive } from "#package-check/archive.ts";
import { workspaceArchives } from "#package-check/archives.ts";
import { checkConsumers } from "#package-check/consumers.ts";
import { writeJson } from "#package-check/io.ts";

export const consumers = storyKit({
	after: {
		workspace: ({ root }) =>
			Effect.gen(function* () {
				for (const pkg of yield* workspaceArchives(root, root)) {
					yield* packArchive(pkg);
				}
			}),
	},
	clock: "live",
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "consumer-story-" });
		const temporary = join(root, "consumers");
		for (const path of ["packages/probe", "script/package-check/fixtures/probe", "consumers"]) {
			yield* fs.makeDirectory(join(root, path), { recursive: true });
		}
		const workspace = yield* fs.readFileString(join(process.cwd(), "pnpm-workspace.yaml"));
		yield* fs.writeFileString(join(root, "pnpm-workspace.yaml"), `${workspace}\noffline: true\n`);
		yield* writeJson(join(root, "script/package-check/browser-entries.json"), {});
		yield* writeJson(join(root, "script/package-check/fixture-files.json"), {});
		yield* writeJson(join(root, "packages/probe/package.json"), {
			bin: { "packed-probe": "./cli.js" },
			name: "packed-probe",
			type: "module",
			version: "1.0.0",
		});
		yield* writeJson(join(root, "script/package-check/bin-cases.json"), {
			"packed-probe": { args: [], expectedFiles: {}, files: {}, output: "bin passed" },
		});
		yield* writeJson(join(root, "script/package-check/consumer-cases.json"), {
			probe: [{ entries: [], fixtures: ["scenario.ts.txt"], omitOptionalPeers: false, run: ["scenario.ts"] }],
		});
		yield* writeJson(join(root, "observations.json"), []);
		return { root, temporary };
	},
	layer: NodeServices.layer,
	name: "packed consumer lifetime",
	stages: ["workspace"],
	verbs: ({ root, temporary }) => ({
		check: Effect.fn("ConsumerStory.check")(function* () {
			return yield* checkConsumers(root, yield* workspaceArchives(root, root), temporary, { count: 1, index: 1 }, undefined, undefined).pipe(
				Effect.match({ onFailure: String, onSuccess: () => undefined }),
			);
		}),
		observations: Effect.fn("ConsumerStory.observations")(function* () {
			return JSON.parse(yield* (yield* FileSystem.FileSystem).readFileString(join(root, "observations.json")));
		}),
		remaining: () => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readDirectory(temporary)),
	}),
});

export function consumerRun(failure?: "consumer" | "bin" | "scenario") {
	return consumers.trait("workspace", failure === undefined ? "all checks pass" : `the ${failure} check fails`, function* ({ root, temporary }) {
		const fs = yield* FileSystem.FileSystem;
		for (const [stage, path] of [
			["consumer", "script/package-check/fixtures/probe/runtime-probe.ts.txt"],
			["bin", "packages/probe/cli.js"],
			["scenario", "script/package-check/fixtures/probe/scenario.ts.txt"],
		] as const) {
			const source = `import { readFileSync, readdirSync, writeFileSync } from "node:fs";
const trace = ${JSON.stringify(join(root, "observations.json"))};
const observations = JSON.parse(readFileSync(trace, "utf8"));
observations.push({ stage: ${JSON.stringify(stage)}, directories: readdirSync(${JSON.stringify(temporary)}).length });
writeFileSync(trace, JSON.stringify(observations));
${stage === failure ? `throw new Error("${stage} defect");` : 'console.log("bin passed");'}
`;
			yield* fs.writeFileString(join(root, path), stage === "bin" ? `#!/usr/bin/env node\n${source}` : source);
		}
	});
}

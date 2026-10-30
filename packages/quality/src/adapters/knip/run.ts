import { createRequire } from "node:module";
import { basename, dirname, join, posix } from "node:path";
import process from "node:process";
import { Effect, FileSystem, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import type { RuleInputs } from "#rule.ts";
import { knipConfiguration } from "./configuration.ts";
import { entryPointFindings } from "./entryPointFindings.ts";
import { KNIP_ISSUES, knipFindings } from "./findings.ts";
import { sourceConfig } from "./sourceConfig.ts";

const BIN = join(dirname(createRequire(import.meta.url).resolve("knip")), "..", "bin", "knip.js");
export const runKnip = Effect.fn("Knip.runKnip")(function* (inputs: RuleInputs) {
	if ((yield* Effect.promise(() => inputs.readText("package.json"))) === undefined) {
		return [];
	}
	const configuration = yield* Effect.promise(() => knipConfiguration(inputs));
	const checked = new Set([...inputs.files, ...Object.keys(configuration.workspaces).map((directory) => posix.join(directory, "package.json"))]);
	const findings = yield* Effect.scoped(
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "quality-knip-" });
			const config = join(temporary, "knip.json");
			yield* fs.writeFileString(config, JSON.stringify(configuration));
			const tsconfig = yield* sourceConfig(inputs, Object.keys(configuration.workspaces), basename(temporary));
			const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
			const child = yield* spawner.spawn(
				ChildProcess.make(
					process.execPath,
					[
						"--conditions=source",
						BIN,
						"--config",
						config,
						"--tsConfig",
						tsconfig,
						"--reporter",
						"json",
						"--include",
						KNIP_ISSUES.join(","),
						"--no-progress",
					],
					{ cwd: inputs.root, env: { "JITI_TRY_NATIVE": "true" }, extendEnv: true, stdin: "ignore" },
				),
			);
			const [stdout, stderr, code] = yield* Effect.all(
				[Stream.mkString(Stream.decodeText(child.stdout)), Stream.mkString(Stream.decodeText(child.stderr)), child.exitCode],
				{ concurrency: "unbounded" },
			);
			if (Number(code) > 1) {
				return yield* Effect.fail(new Error(`knip failed: ${stderr || `exit code ${code}`}`));
			}
			return knipFindings(stdout).filter((finding) => checked.has(finding.file));
		}),
	);
	return yield* Effect.promise(() => entryPointFindings(inputs, findings));
});

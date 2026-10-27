import { createRequire } from "node:module";
import { dirname, join, posix } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import type { RuleInputs } from "#rule.ts";
import { knipConfiguration } from "./configuration.ts";
import { knipFindings } from "./findings.ts";

const BIN = join(dirname(createRequire(import.meta.url).resolve("knip")), "..", "bin", "knip.js");
const INCLUDE = "files,exports,types,nsExports,nsTypes,dependencies,devDependencies,optionalPeerDependencies,unlisted";

export async function runKnip(inputs: RuleInputs) {
	if ((await inputs.readText("package.json")) === undefined) {
		return [];
	}
	const configuration = await knipConfiguration(inputs);
	const checked = new Set([...inputs.files, ...Object.keys(configuration.workspaces).map((directory) => posix.join(directory, "package.json"))]);
	return Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "quality-knip-" });
				const config = join(temporary, "knip.json");
				yield* fs.writeFileString(config, JSON.stringify(configuration));
				const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
				const child = yield* spawner.spawn(
					ChildProcess.make(
						process.execPath,
						["--conditions=source", BIN, "--config", config, "--reporter", "json", "--include", INCLUDE, "--no-progress"],
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
		).pipe(Effect.provide(NodeServices.layer)),
	);
}

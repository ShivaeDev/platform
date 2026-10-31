import { createRequire } from "node:module";
import { basename, dirname, join, posix } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { Effect, FileSystem, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { shadcnFolders } from "#inventory/shadcnFolders.ts";
import type { RuleInputs } from "#rule.ts";
import { knipConfiguration } from "./configuration.ts";
import { entryPointFindings } from "./entryPointFindings.ts";
import { KNIP_ISSUES, knipFindings } from "./findings.ts";
import { sourceConfig } from "./sourceConfig.ts";

const API = createRequire(import.meta.url).resolve("knip");
const BIN = join(dirname(API), "..", "bin", "knip.js");
// Initialize the loader in isolation, then evaluate application configs from their checkout.
const LAUNCH = `
const [api, entry, root] = process.argv.splice(1, 3);
import(api).then(() => { process.chdir(root); return import(entry); })
.catch(error => { console.error(error); process.exitCode = 1; });
`;
export const runKnip = Effect.fn("Knip.runKnip")(function* (inputs: RuleInputs) {
	if ((yield* Effect.promise(() => readPackageManifest(inputs.readText, "package.json"))) === undefined) {
		return [];
	}
	const folders = yield* shadcnFolders(inputs.root);
	const configuration = yield* Effect.promise(() => knipConfiguration(inputs, folders));
	const checked = new Set([...inputs.files, ...Object.keys(configuration.workspaces).map((directory) => posix.join(directory, "package.json"))]);
	const findings = yield* Effect.scoped(
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "quality-knip-" });
			const config = join(temporary, "knip.json");
			yield* fs.writeFileString(config, JSON.stringify(configuration));
			const tsconfig = yield* sourceConfig(inputs, Object.keys(configuration.workspaces), basename(temporary));
			const cwd = join(inputs.root, posix.dirname(tsconfig), "run");
			const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
			const child = yield* spawner.spawn(
				ChildProcess.make(
					process.execPath,
					[
						"--conditions=source",
						"--eval",
						LAUNCH,
						pathToFileURL(API).href,
						pathToFileURL(BIN).href,
						inputs.root,
						"--directory",
						inputs.root,
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
					{ cwd, env: { "JITI_TRY_NATIVE": "true" }, extendEnv: true, stdin: "ignore" },
				),
			);
			const [stdout, stderr, code] = yield* Effect.all(
				[Stream.mkString(Stream.decodeText(child.stdout)), Stream.mkString(Stream.decodeText(child.stderr)), child.exitCode],
				{ concurrency: "unbounded" },
			);
			const report = yield* Effect.try(() => knipFindings(stdout)).pipe(
				Effect.mapError(() => new Error(`knip exited ${code} without a valid report:\n${stderr || stdout || "No output."}`)),
			);
			if (Number(code) !== (report.length > 0 ? 1 : 0)) {
				return yield* Effect.fail(new Error(`knip exited ${code} inconsistently with its report:\n${stderr || stdout}`));
			}
			return report.filter((finding) => checked.has(finding.file));
		}),
	);
	return yield* Effect.promise(() => entryPointFindings(inputs, findings));
});

import { join } from "node:path";
import process from "node:process";
import { codecovRollupPlugin } from "@codecov/rollup-plugin";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { Config, Console, Effect, FileSystem } from "effect";
import { rollup } from "rollup";
import { bundleEntries } from "#ci/bundleEntries.ts";
import { decodeManifest } from "#package-check/model.ts";

const program = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const upload = yield* Config.boolean("CODECOV_UPLOAD").pipe(Config.withDefault(false));
	const oidc = yield* Config.boolean("CODECOV_USE_OIDC").pipe(Config.withDefault(false));
	for (const name of (yield* fs.readDirectory("packages")).sort()) {
		const directory = join(process.cwd(), "packages", name);
		const manifestPath = join(directory, "package.json");
		if (!(yield* fs.exists(manifestPath))) {
			continue;
		}
		const manifest = decodeManifest(yield* fs.readFileString(manifestPath));
		const input = bundleEntries(directory, manifest);
		if (manifest.private === true || Object.keys(input).length === 0) {
			continue;
		}
		yield* Console.log(`Analyzing ${manifest.name}: ${Object.keys(input).join(", ")}`);
		yield* Effect.tryPromise(async () => {
			const bundle = await rollup({
				external: (id) => !(id.startsWith(".") || id.startsWith("/") || id.startsWith("#")),
				input,
				plugins: [
					nodeResolve(),
					// Capture upload sizes before the local stats plugin emits its JSON asset.
					...[...(upload ? [false] : []), true].map((dryRun) =>
						codecovRollupPlugin({
							bundleName: manifest.name,
							dryRun,
							enableBundleAnalysis: true,
							gitService: "github",
							oidc: { "useGitHubOIDC": oidc },
							telemetry: false,
						}),
					),
				],
			});
			try {
				await bundle.write({ dir: join(".ci", "bundles", name), format: "es", sourcemap: true });
			} finally {
				await bundle.close();
			}
		});
	}
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));

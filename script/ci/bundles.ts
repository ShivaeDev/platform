import { basename, join, posix } from "node:path";
import process from "node:process";
import { codecovRollupPlugin } from "@codecov/rollup-plugin";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { Config, Console, Effect, FileSystem } from "effect";
import { rollup } from "rollup";
import { command } from "#package-check/io.ts";
import { decodeManifest } from "#package-check/model.ts";
import { bundleEntries } from "./bundleEntries.ts";

const archives = process.argv[2] ?? join(".ci", "packages");
const reports = join(".ci", "bundles");

function analysis(bundleName: string, dryRun: boolean) {
	return codecovRollupPlugin({ bundleName, dryRun, enableBundleAnalysis: true, gitService: "github", telemetry: false });
}

const program = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const upload = yield* Config.boolean("CODECOV_UPLOAD").pipe(Config.withDefault(false));
	const tarballs = (yield* fs.readDirectory(archives)).filter((file) => file.endsWith(".tgz")).toSorted();
	if (tarballs.length === 0) {
		return yield* Effect.fail(new Error(`No package archives in ${archives}; run pnpm test:package --prepare ${archives}`));
	}
	for (const tarball of tarballs) {
		const directory = join(process.cwd(), reports, basename(tarball, ".tgz"));
		yield* fs.remove(directory, { force: true, recursive: true });
		yield* fs.makeDirectory(directory, { recursive: true });
		yield* command(directory, "tar", ["-xzf", join(process.cwd(), archives, tarball)]);
		const listing = yield* command(directory, "tar", ["-tzf", join(process.cwd(), archives, tarball)]);
		const packed = new Set(
			listing
				.trim()
				.split("\n")
				.map((path) => posix.relative("package", path)),
		);
		const manifest = decodeManifest(yield* fs.readFileString(join(directory, "package", "package.json")));
		const entries = bundleEntries(manifest, packed);
		if (manifest.private === true || Object.keys(entries).length === 0) {
			continue;
		}
		yield* Console.log(`Analyzing ${manifest.name}: ${Object.keys(entries).length} entries`);
		yield* Effect.tryPromise(async () => {
			const bundle = await rollup({
				external: (id) => !(id.startsWith(".") || id.startsWith("/") || id.startsWith("#")),
				input: Object.fromEntries(Object.entries(entries).map(([name, path]) => [name, join(directory, "package", path)])),
				// The uploading plugin runs first so its sizes leave out the stats asset the dry run emits for the artifact.
				plugins: [nodeResolve(), ...(upload ? [analysis(manifest.name, false)] : []), analysis(manifest.name, true)],
			});
			try {
				await bundle.write({ dir: join(directory, "output"), format: "es" });
			} finally {
				await bundle.close();
			}
		});
	}
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));

import { basename, join } from "node:path";
import process from "node:process";
import { createAndUploadReport } from "@codecov/bundle-analyzer";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Config, Console, Effect, FileSystem } from "effect";
import { command } from "#package-check/io.ts";
import { decodeManifest } from "#package-check/model.ts";

const archives = process.argv[2] ?? join(".ci", "packages");
const reports = join(".ci", "bundles");

const program = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const upload = yield* Config.boolean("CODECOV_UPLOAD").pipe(Config.withDefault(false));
	const tarballs = (yield* fs.readDirectory(archives)).filter((file) => file.endsWith(".tgz")).toSorted();
	if (tarballs.length === 0) {
		return yield* Effect.fail(new Error(`No package archives in ${archives}; run pnpm test:package --prepare ${archives}`));
	}
	for (const tarball of tarballs) {
		const name = basename(tarball, ".tgz");
		const directory = join(process.cwd(), reports, name);
		yield* fs.remove(directory, { force: true, recursive: true });
		yield* fs.makeDirectory(directory, { recursive: true });
		yield* command(directory, "tar", ["-xzf", join(process.cwd(), archives, tarball), "package/package.json", "package/dist"]);
		const manifest = decodeManifest(yield* fs.readFileString(join(directory, "package", "package.json")));
		if (manifest.private === true) {
			continue;
		}
		const stats = yield* Effect.tryPromise(() =>
			createAndUploadReport(
				[join(directory, "package", "dist")],
				{ bundleName: manifest.name, dryRun: !upload, enableBundleAnalysis: true, gitService: "github", telemetry: false },
				{ ignorePatterns: ["*.map", "*.d.ts"] },
			),
		);
		yield* fs.writeFileString(join(reports, `${name}.json`), stats);
		yield* Console.log(`${upload ? "Uploaded" : "Measured"} ${manifest.name}`);
	}
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));

import { join } from "node:path";
import process from "node:process";
import { NodeFileSystem, NodeRuntime } from "@effect/platform-node";
import { Console, Effect, FileSystem } from "effect";
import { checkArchive } from "#package-check/archive.ts";
import { checkBins } from "#package-check/bins.ts";
import { checkConsumer } from "#package-check/consumer.ts";
import { command } from "#package-check/io.ts";
import { decodeManifest, decodeVersions, type Package } from "#package-check/model.ts";
import { checkSharedPeerRegression } from "#package-check/peer-regression.ts";
import { scenarios } from "#package-check/scenarios.ts";

const program = Effect.gen(function* () {
	const root = process.cwd();
	const fs = yield* FileSystem.FileSystem;
	const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "platform-packages-" });
	const catalog = decodeVersions(yield* command(root, "pnpm", ["config", "get", "catalog", "--json"]));
	const packages: Package[] = [];
	for (const name of yield* fs.readDirectory(join(root, "packages"))) {
		const directory = join(root, "packages", name);
		if (!(yield* fs.exists(join(directory, "package.json")))) {
			continue;
		}
		const manifest = decodeManifest(yield* fs.readFileString(join(directory, "package.json")));
		if (manifest.private === true) {
			continue;
		}
		const pkg = { directory, manifest, tarball: join(temporary, `${name}.tgz`) };
		yield* checkArchive(pkg);
		packages.push(pkg);
	}
	for (const pkg of packages) {
		yield* Console.log(`Checking packed ${pkg.manifest.name}`);
		const consumer = join(temporary, pkg.manifest.name.replace("/", "-"));
		yield* checkConsumer(root, pkg, packages, catalog, consumer);
		yield* checkBins(root, pkg, consumer);
		let index = 0;
		for (const scenario of yield* scenarios(root, pkg)) {
			yield* checkConsumer(root, pkg, packages, catalog, `${consumer}-${index++}`, scenario);
		}
		yield* Console.log(`Passed packed ${pkg.manifest.name}`);
	}
	yield* checkSharedPeerRegression(packages);
});
NodeRuntime.runMain(program.pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)));

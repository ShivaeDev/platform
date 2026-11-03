import { join } from "node:path";
import process from "node:process";
import { Effect, FileSystem } from "effect";
import { command, writeJson } from "#package-check/io.ts";
import { decodeManifest } from "#package-check/model.ts";

export const localConsumerWorkspace = Effect.fn("ConsumerStory.localConsumerWorkspace")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const modules = join(process.cwd(), "node_modules");
	const effect = decodeManifest(yield* fs.readFileString(join(modules, "effect/package.json")));
	const compiler = yield* fs.realPath(join(modules, "@typescript/native"));
	const effectDirectory = yield* fs.realPath(join(modules, "effect"));
	const store = (yield* command(process.cwd(), "pnpm", ["store", "path", "--silent"])).trim();
	const nodeTypes = join(root, "node-types");
	yield* fs.makeDirectory(nodeTypes);
	yield* writeJson(join(nodeTypes, "package.json"), { name: "@types/node", private: true, types: "index.d.ts", version: "0.0.0" });
	// Lifetime probes need only these built-ins; the full Node type graph adds unrelated compiler work to every install.
	yield* fs.copyFile(join(process.cwd(), "script/package-check/test-support/probeNodeTypes.d.ts.txt"), join(nodeTypes, "index.d.ts"));
	const catalog = { "@types/node": `link:${nodeTypes}`, "@typescript/native": `link:${compiler}`, effect: effect.version };
	const pnpmfile = join(root, ".pnpmfile.cjs");
	yield* fs.writeFileString(
		pnpmfile,
		`module.exports = { hooks: { readPackage(pkg) {
  if (pkg.name === "packed-consumer") pkg.dependencies.effect = ${JSON.stringify(`file:${effectDirectory}`)};
  return pkg;
} } };\n`,
	);
	yield* fs.writeFileString(
		join(root, "pnpm-workspace.yaml"),
		[
			"packages: [packages/*]",
			"offline: true",
			`pnpmfile: ${JSON.stringify(pnpmfile)}`,
			"overrides:",
			'  effect: "catalog:"',
			`storeDir: ${JSON.stringify(store)}`,
			"catalog:",
			...Object.entries(catalog).map(([name, version]) => `  ${JSON.stringify(name)}: ${JSON.stringify(version)}`),
			"",
		].join("\n"),
	);
});

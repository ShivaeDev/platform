import { cp } from "node:fs/promises";
import { basename, join } from "node:path";
import { Effect, FileSystem, Schema } from "effect";
import { command, requireThat, writeJson } from "#package-check/io.ts";
import { decodeManifest, decodeVersions, Versions } from "#package-check/model.ts";

const StarterManifest = Schema.Struct({
	dependencies: Versions,
	devDependencies: Versions,
	engines: Versions,
	imports: Versions,
	name: Schema.String,
	packageManager: Schema.String,
	private: Schema.Boolean,
	scripts: Versions,
	type: Schema.String,
	version: Schema.String,
});

export function registryDependencies(dependencies: Readonly<Record<string, string>>, versions: Readonly<Record<string, string>>) {
	return Object.fromEntries(
		Object.entries(dependencies).map(([name, version]) => {
			if (!version.startsWith("workspace:")) {
				return [name, version];
			}
			const published = versions[name];
			if (published === undefined || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/u.test(published)) {
				throw new Error(`${name}: name an exact published version in published-versions.json`);
			}
			return [name, published];
		}),
	);
}

export const copyStarter = Effect.fn("Published.copyStarter")(function* (root: string, consumer: string, versions: Readonly<Record<string, string>>) {
	const fs = yield* FileSystem.FileSystem;
	const starter = join(root, "examples/starter");
	yield* Effect.tryPromise(() =>
		cp(starter, consumer, {
			filter: (path) =>
				!["node_modules", "dist", "coverage", "pnpm-lock.yaml"].includes(basename(path))
				&& (!basename(path).startsWith(".env") || basename(path) === ".env.example"),
			recursive: true,
			verbatimSymlinks: true,
		}),
	);
	const manifest = Schema.decodeUnknownSync(Schema.fromJsonString(StarterManifest), { propertyOrder: "original" })(
		yield* fs.readFileString(join(consumer, "package.json")),
	);
	const { "check:published": _check, ...scripts } = manifest.scripts;
	yield* fs.writeFileString(
		join(consumer, "package.json"),
		`${JSON.stringify(
			{
				...manifest,
				dependencies: registryDependencies(manifest.dependencies, versions),
				devDependencies: registryDependencies(manifest.devDependencies, versions),
				scripts,
			},
			null,
			"\t",
		)}\n`,
	);
	yield* fs.rename(join(consumer, "pnpm-workspace.copy.yaml"), join(consumer, "pnpm-workspace.yaml"));
	const biome = join(consumer, "biome.json");
	yield* fs.writeFileString(biome, (yield* fs.readFileString(biome)).replace('"root": false', '"root": true'));
	for (const file of ["tsconfig.json", "vite.config.ts", "vitest.config.ts"]) {
		const path = join(consumer, file);
		const source = yield* fs.readFileString(path);
		yield* fs.writeFileString(path, source.replaceAll('"source", ', "").replaceAll('["source"]', "[]"));
	}
});

export const installDocumentation = Effect.fn("Published.installDocumentation")(function* (
	root: string,
	consumer: string,
	versions: Readonly<Record<string, string>>,
) {
	const fs = yield* FileSystem.FileSystem;
	const catalog = decodeVersions(yield* command(root, "pnpm", ["config", "get", "catalog", "--json"]));
	const dependencies: Record<string, string> = {
		...registryDependencies(Object.fromEntries(Object.keys(versions).map((name) => [name, "workspace:*"])), versions),
		"@types/node": catalog["@types/node"] ?? "",
		typescript: catalog.typescript ?? "",
	};
	for (const name of Object.keys(versions)) {
		const manifest = decodeManifest(yield* fs.readFileString(join(root, "packages", name.split("/")[1] ?? "", "package.json")));
		for (const [peer, version] of Object.entries(manifest.peerDependencies ?? {})) {
			const resolved = versions[peer] ?? (version === "catalog:" ? catalog[peer] : version);
			yield* requireThat(resolved !== undefined, `${name}: missing documentation peer ${peer}`);
			dependencies[peer] = resolved ?? "";
		}
	}
	yield* fs.makeDirectory(consumer);
	yield* writeJson(join(consumer, "package.json"), { dependencies, private: true, type: "module" });
	yield* fs.writeFileString(
		join(consumer, "pnpm-workspace.yaml"),
		`packages: []\noverrides:\n  "@effect/platform-node-shared": ${catalog["@effect/platform-node-shared"]}\nallowBuilds:\n  esbuild: true\n  msgpackr-extract: true\n`,
	);
	yield* command(consumer, "pnpm", ["install", "--registry=https://registry.npmjs.org", "--frozen-lockfile=false"]);
});

import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { requireThat } from "#package-check/io.ts";
import { decodeManifest, effectPackage } from "#package-check/model.ts";

export const checkEffectCopies = (consumer: string, catalog: Readonly<Record<string, string>>) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const store = join(consumer, "node_modules/.pnpm");
		const copies = new Map<string, string[]>();
		for (const directory of yield* fs.readDirectory(store)) {
			if (!(directory.startsWith("effect@") || directory.startsWith("@effect+"))) {
				continue;
			}
			for (const { name, version, real } of yield* effectCopies(join(store, directory), directory.startsWith("effect@"))) {
				yield* requireThat(version === catalog[name], `${name}: resolved ${version}, catalog requires ${catalog[name]}`);
				copies.set(name, [...new Set([...(copies.get(name) ?? []), real])]);
			}
		}
		yield* requireThat(copies.has("effect"), "Consumer did not install Effect");
		for (const [name, paths] of copies) {
			yield* requireThat(paths.length === 1, `${name}: ${paths.length} physical copies\n${paths.join("\n")}`);
		}
	});

const effectCopies = (directory: string, core: boolean) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const modules = join(directory, "node_modules");
		const names = core ? ["effect"] : (yield* fs.readDirectory(join(modules, "@effect"))).map((name) => `@effect/${name}`);
		const copies: Array<{ name: string; version: string; real: string }> = [];
		for (const name of names) {
			const real = yield* fs.realPath(join(modules, name));
			const manifest = decodeManifest(yield* fs.readFileString(join(real, "package.json")));
			if (effectPackage(manifest.name)) {
				copies.push({ name: manifest.name, real, version: manifest.version });
			}
		}
		return copies;
	});

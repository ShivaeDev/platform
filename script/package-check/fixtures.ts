import { basename, join } from "node:path";
import { Effect, FileSystem, Schema } from "effect";
import ts from "typescript";
import { type Package, Versions } from "#package-check/model.ts";

const decodeFiles = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Record(Schema.String, Versions)));

export const writeFixtures = (root: string, pkg: Package, consumer: string, selected?: readonly string[]) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const directory = join(root, "script/package-check/fixtures", pkg.directory.split("/").at(-1) ?? "");
		const imports = new Set<string>();
		const references = new Set<string>();
		if (!(yield* fs.exists(directory))) {
			return imports;
		}
		for (const file of selected ?? (yield* topLevelFiles(directory))) {
			const source = yield* fs.readFileString(join(directory, file));
			yield* fs.writeFileString(join(consumer, basename(file).replace(/\.txt$/u, "")), source);
			for (const name of importedPackages(source)) {
				imports.add(name);
			}
			ts.preProcessFile(source).importedFiles.forEach(({ fileName }) => {
				references.add(fileName);
			});
		}
		for (const name of yield* copyFixtureFiles(root, pkg, consumer, references)) {
			imports.add(name);
		}
		return imports;
	});

const topLevelFiles = (directory: string) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const files: string[] = [];
		for (const name of yield* fs.readDirectory(directory)) {
			if ((yield* fs.stat(join(directory, name))).type === "File") {
				files.push(name);
			}
		}
		return files;
	});

const importedPackages = (source: string): string[] =>
	ts
		.preProcessFile(source)
		.importedFiles.map((entry) => entry.fileName)
		.filter((name) => !name.startsWith("."))
		.map((name) => (name.startsWith("@") ? name.split("/").slice(0, 2).join("/") : (name.split("/")[0] ?? "")));

const copyFixtureFiles = (root: string, pkg: Package, consumer: string, references: ReadonlySet<string>) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const imports = new Set<string>();
		const fixtureFiles = decodeFiles(yield* fs.readFileString(join(root, "script/package-check/fixture-files.json")));
		for (const [target, source] of Object.entries(fixtureFiles[pkg.directory.split("/").at(-1) ?? ""] ?? {})) {
			if (!references.has(`./${target.replace(/\.d\.ts$/u, ".js")}`)) {
				continue;
			}
			yield* fs.copyFile(join(root, source), join(consumer, target));
			for (const name of importedPackages(yield* fs.readFileString(join(root, source)))) {
				imports.add(name);
			}
		}
		return imports;
	});

import { Console, Effect, FileSystem, Path } from "effect";
import { MIGRATION_FILE_PATTERN } from "@shivaedev/sql/migration.ts";
import { CreateAppError } from "#CreateAppError.ts";
import { GENERATION_FILE } from "#generation.ts";
import { resourceFiles } from "#resource/files.ts";
import { resourceNames } from "#resource/names.ts";

export const addResource = Effect.fn("CreateApp.addResource")(function* (folder: string, name: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const root = path.resolve(folder);
	const names = yield* resourceNames(name);
	if (!(yield* fs.exists(path.join(root, GENERATION_FILE)))) {
		return yield* new CreateAppError({ message: `Run create-app resource from a generated app (${GENERATION_FILE} is missing).` });
	}
	const registry = "src/server/modules.ts";
	const source = yield* fs.readFileString(path.join(root, registry));
	const declaration = /const modules = \[[\s\S]*?\] as const;/gu;
	if ([...source.matchAll(declaration)].length !== 1) {
		return yield* new CreateAppError({ message: `Cannot register ${name}: ${registry} must declare const modules = [...] as const;` });
	}
	const qualityConfig = "quality.config.ts";
	const qualitySource = yield* fs.readFileString(path.join(root, qualityConfig));
	const generatedFolder = `"imports/resolvable": { options: { generated: ["src/generated"] } }`;
	const rulesEnd = /\n\t\},\n\}\);\n$/u;
	const declared = qualitySource.includes('generated: ["src/generated"]');
	if (!declared && (qualitySource.includes('"imports/resolvable"') || !rulesEnd.test(qualitySource))) {
		return yield* new CreateAppError({
			message: `Cannot declare src/generated for ${name}: add ${generatedFolder} to the rules in ${qualityConfig}, then run the command again.`,
		});
	}
	const files = yield* fs.readDirectory(path.join(root, "src"), { recursive: true });
	const ids = files
		.filter((file) => path.basename(path.dirname(file)) === "migrations" && MIGRATION_FILE_PATTERN.test(path.basename(file)))
		.map((file) => Number(path.basename(file).slice(0, 4)));
	const migration = String(Math.max(0, ...ids) + 1).padStart(4, "0");
	const generated = resourceFiles(names, migration);
	const existing: string[] = [];
	for (const file of Object.keys(generated)) {
		if (yield* fs.exists(path.join(root, file))) {
			existing.push(file);
		}
	}
	if (existing.length > 0) {
		return yield* new CreateAppError({ message: `Refusing to overwrite existing files:\n${existing.join("\n")}` });
	}
	for (const [file, content] of Object.entries(generated)) {
		yield* fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true });
		yield* fs.writeFileString(path.join(root, file), content, { flag: "wx", mode: 0o644 });
	}
	const registration = `${names.camel}Registration`;
	const specifier = `#modules/${name}/server/registration.ts`;
	const lines = source
		.replace(declaration, (list) => list.replace(/^const modules = \[/u, `const modules = [${registration}${list.includes("[]") ? "" : ", "}`))
		.split("\n");
	const following = lines.findIndex((line) => /^import .* from "#/u.test(line) && line.slice(line.indexOf('from "') + 6) > specifier);
	lines.splice(
		following === -1 ? lines.findLastIndex((line) => line.startsWith("import ")) + 1 : following,
		0,
		`import { ${registration} } from "${specifier}";`,
	);
	yield* fs.writeFileString(path.join(root, registry), lines.join("\n"));
	if (!declared) {
		yield* fs.writeFileString(path.join(root, qualityConfig), qualitySource.replace(rulesEnd, `\n\t\t${generatedFolder},\n\t},\n});\n`));
	}
	yield* Console.log(`Added ${name}.\n\nNext steps:\n  pnpm format\n  pnpm migrate\n  pnpm test src/modules/${name}/server/lifecycle.spec.ts`);
});

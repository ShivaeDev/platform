import { Effect, FileSystem, Path } from "effect";
import { definesModule, readConfig } from "#adapters/typeScript.ts";
import { generatorFingerprint, type Project } from "#inputs.ts";

export interface ModuleFile {
	readonly module: string;
	readonly output: string;
}

export const openProject = Effect.fn("Build.openProject")(function* (directory: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const root = yield* fs.realPath(directory);
	const config = yield* readConfig(path.join(root, "tsconfig.json"));
	const project: Project = { config, generated: `${path.join(root, "src", "generated")}${path.sep}`, generator: yield* generatorFingerprint(), root };
	return project;
});

// Every file of the tsconfig that calls defineModule, so no list of modules needs keeping; each writes src/generated/<its path under src>.
export const moduleFiles = Effect.fn("Build.moduleFiles")(function* (project: Project) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const sources = project.config.files.filter((file) => !(file.startsWith(project.generated) || file.endsWith(".d.ts"))).sort();
	const modules = yield* Effect.filter(sources, (file) => Effect.map(fs.readFileString(file), (text) => definesModule(file, text)));
	const source = path.join(project.root, "src");
	return modules.map((module): ModuleFile & { readonly underSource: boolean } => {
		const underSource = path.relative(source, module);
		return { module, output: path.join(project.generated, underSource), underSource: !underSource.startsWith("..") };
	});
});

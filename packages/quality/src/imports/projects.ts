import { dirname, join, relative } from "node:path";
import ts from "typescript";

export interface Project {
	readonly cache: ts.ModuleResolutionCache;
	readonly options: ts.CompilerOptions;
	readonly typesCache: ts.ModuleResolutionCache;
	readonly typesOptions: ts.CompilerOptions;
}

interface ParsedProject {
	readonly files: ReadonlySet<string>;
	readonly key: string;
	readonly options: ts.CompilerOptions;
	readonly references: readonly string[];
}

const CONFIG = "tsconfig.json";

const SOURCE_CONDITION = "source";

const quietHost: ts.ParseConfigFileHost = { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined };

function resolutionOptions(options: ts.CompilerOptions, declarations: boolean): ts.CompilerOptions {
	return {
		...options,
		allowArbitraryExtensions: declarations,
		allowImportingTsExtensions: true,
		allowJs: true,
		customConditions: [...new Set([SOURCE_CONDITION, ...(options.customConditions ?? [])])],
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		noDtsResolution: !declarations,
		resolveJsonModule: true,
		resolvePackageJsonExports: true,
		resolvePackageJsonImports: true,
	};
}

function projectOf(root: string, options: ts.CompilerOptions): Project {
	const runtime = resolutionOptions(options, false);
	const types = resolutionOptions(options, true);
	return {
		cache: ts.createModuleResolutionCache(root, (file) => file, runtime),
		options: runtime,
		typesCache: ts.createModuleResolutionCache(root, (file) => file, types),
		typesOptions: types,
	};
}

function parse(path: string): ParsedProject {
	const parsed = ts.getParsedCommandLineOfConfigFile(path, {}, quietHost);
	return {
		files: new Set(parsed?.fileNames ?? []),
		key: path,
		options: parsed?.options ?? {},
		references: (parsed?.projectReferences ?? []).map((reference) => ts.resolveProjectReferencePath(reference)),
	};
}

function nearestConfig(root: string, file: string): string | undefined {
	for (let directory = dirname(file); !relative(root, directory).startsWith(".."); directory = dirname(directory)) {
		const candidate = join(directory, CONFIG);
		if (ts.sys.fileExists(candidate)) {
			return candidate;
		}
		if (directory === root) {
			return undefined;
		}
	}
	return undefined;
}

function memo<Value>(compute: (key: string) => Value): (key: string) => Value {
	const known = new Map<string, Value>();
	return (key) => {
		const value = known.get(key) ?? compute(key);
		known.set(key, value);
		return value;
	};
}

// A file resolves with the options of the project that includes it: the nearest tsconfig.json, or a project it references.
export function projectsFor(root: string): (file: string) => Project {
	const parsedAt = memo(parse);
	function withReferences(path: string, seen: Set<string>): readonly ParsedProject[] {
		if (seen.has(path)) {
			return [];
		}
		seen.add(path);
		const project = parsedAt(path);
		return [project, ...project.references.flatMap((reference) => withReferences(reference, seen))];
	}
	const familyAt = memo((config) => withReferences(config, new Set()));
	const projects = new Map<string, Project>();
	return (file) => {
		const config = nearestConfig(root, file);
		const owner = config === undefined ? undefined : (familyAt(config).find((candidate) => candidate.files.has(file)) ?? parsedAt(config));
		const key = owner?.key ?? "";
		const project = projects.get(key) ?? projectOf(root, owner?.options ?? {});
		projects.set(key, project);
		return project;
	};
}

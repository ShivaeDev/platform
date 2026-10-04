import { posix } from "node:path";
import type { RuleInputs } from "#rule.ts";

export interface PackageLayout {
	readonly foldersOf: (path: string) => readonly string[];
	readonly names: ReadonlyMap<string, string>;
	readonly scripts: ReadonlySet<string>;
}

const MANIFEST = "package.json";

const SOURCE_FOLDER = "src";

const RUNNABLE = /\.[cm]?[jt]sx?$/u;

const BUILT = /^dist\/(?<entry>.+)\.[cm]?js$/u;

function parsed(text: string | undefined): unknown {
	if (text === undefined) {
		return undefined;
	}
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

function field(value: unknown, key: string): unknown {
	return typeof value === "object" && value !== null && key in value ? Reflect.get(value, key) : undefined;
}

function texts(value: unknown): readonly string[] {
	if (typeof value === "string") {
		return [value];
	}
	return typeof value === "object" && value !== null ? Object.values(value).filter((entry): entry is string => typeof entry === "string") : [];
}

function sourcesOf(target: string): readonly string[] {
	const built = BUILT.exec(target)?.groups?.entry;
	return built === undefined ? [target] : [target, `src/${built}.ts`, `src/${built}.tsx`];
}

function packageOf(path: string, roots: readonly string[]): string {
	return roots.find((root) => root === "" || path.startsWith(`${root}/`)) ?? "";
}

function runBy(directory: string, manifest: unknown): readonly string[] {
	const commands = texts(field(manifest, "scripts")).flatMap((command) => command.split(/\s+/u).filter((token) => RUNNABLE.test(token)));
	const bins = texts(field(manifest, "bin")).flatMap(sourcesOf);
	return [...commands, ...bins].map((target) => posix.join(directory, target));
}

export async function packageLayout({ files, readText }: Pick<RuleInputs, "files" | "readText">): Promise<PackageLayout> {
	const directories = ["", ...files.filter((path) => posix.basename(path) === MANIFEST).map((path) => posix.dirname(path))];
	const manifests = await Promise.all(
		[...new Set(directories)].map(async (directory) => ({
			directory: directory === "." ? "" : directory,
			manifest: parsed(await readText(directory === "" ? MANIFEST : `${directory}/${MANIFEST}`)),
		})),
	);
	const present = manifests.filter((entry) => entry.manifest !== undefined);
	const roots = present.map((entry) => entry.directory).toSorted((left, right) => right.length - left.length);
	const names = new Map(present.flatMap(({ directory, manifest }) => texts(field(manifest, "name")).map((name) => [directory, name] as const)));
	return {
		foldersOf: (path) => {
			const root = packageOf(path, roots);
			const folders = posix.dirname(root === "" ? path : path.slice(root.length + 1)).split("/");
			return folders.filter((folder, index) => folder !== "." && !(index === 0 && folder === SOURCE_FOLDER));
		},
		names,
		scripts: new Set(present.flatMap(({ directory, manifest }) => runBy(directory, manifest))),
	};
}

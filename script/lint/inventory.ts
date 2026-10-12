import { join, relative } from "node:path";
import { Effect, type FileSystem } from "effect";
import { type FilesystemFailure, ignoreScopeAt, readRequiredText, walk } from "#lint/adapters/fs.ts";

export interface SourceFile {
	readonly lines: readonly string[];
	readonly path: string;
}

export interface TextFile {
	readonly path: string;
	readonly raw: string;
}

export interface Inventory {
	readonly codecov: string;
	readonly manifests: readonly TextFile[];
	readonly root: string;
	readonly sources: readonly SourceFile[];
	readonly workspaceCatalog: string;
}

interface Entry {
	readonly absolute: string;
	readonly path: string;
}

const WALKED_ZONES = ["packages", "examples", "script"];
const SOURCE_PATH = /\.tsx?$/u;
const WORKSPACE_MANIFEST = /^(?:packages|examples)\/[^/]+\/package\.json$/u;
const INVENTORY_CONCURRENCY = 16;

export function basename(path: string): string {
	return path.split("/").pop() ?? "";
}

export function isDeclaration(path: string): boolean {
	return path.endsWith(".d.ts");
}

function posix(path: string): string {
	return path.replaceAll("\\", "/");
}

function readText(entry: Entry): Effect.Effect<TextFile, FilesystemFailure, FileSystem.FileSystem> {
	return Effect.map(readRequiredText(entry.absolute), (raw) => ({ path: entry.path, raw }));
}

function toSource({ path, raw }: TextFile): SourceFile {
	return { lines: raw.split("\n"), path };
}

export const collectInventory = Effect.fn("Lint.collectInventory")(function* (root: string) {
	const ignores = yield* ignoreScopeAt(root);
	const zones = yield* Effect.all(
		WALKED_ZONES.map((zone) => walk(join(root, zone), ignores)),
		{ concurrency: INVENTORY_CONCURRENCY },
	);
	const entries: readonly Entry[] = zones.flat().map((absolute) => ({ absolute, path: posix(relative(root, absolute)) }));
	const texts = yield* Effect.all(entries.filter((entry) => SOURCE_PATH.test(entry.path)).map(readText), { concurrency: INVENTORY_CONCURRENCY });
	const manifestEntries = [
		{ absolute: join(root, "package.json"), path: "package.json" },
		...entries.filter((entry) => WORKSPACE_MANIFEST.test(entry.path)),
	];
	const manifests = yield* Effect.all(manifestEntries.map(readText), { concurrency: INVENTORY_CONCURRENCY });
	const workspaceCatalog = yield* readRequiredText(join(root, "pnpm-workspace.yaml"));
	const codecov = yield* readRequiredText(join(root, "codecov.yml"));
	return { codecov, manifests, root, sources: texts.map(toSource), workspaceCatalog };
});

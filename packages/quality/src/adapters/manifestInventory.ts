import { posix } from "node:path";
import { Data, Effect, Result, Schema } from "effect";
import type { FilesystemFailure } from "#inventory/filesystem.ts";
import { PackageManifest } from "#PackageManifest.ts";
import type { RuleInputs } from "#rule.ts";

type ReadText = RuleInputs["readText"];

export class ManifestFailure extends Data.TaggedError("ManifestFailure")<{
	readonly message: string;
	readonly path: string;
}> {}

export type ManifestReadFailure = FilesystemFailure | ManifestFailure;

export interface ManifestEntry {
	readonly manifest: PackageManifest;
	readonly text: string;
}

interface ManifestInventory {
	readonly entries: Map<string, Effect.Effect<ManifestEntry | undefined, ManifestReadFailure>>;
	files?: readonly string[];
}

const decodeManifest = Schema.decodeUnknownResult(Schema.fromJsonString(PackageManifest));

const inventories = new WeakMap<ReadText, ManifestInventory>();

function inventoryFor(readText: ReadText): ManifestInventory {
	const known = inventories.get(readText);
	if (known !== undefined) {
		return known;
	}
	const inventory: ManifestInventory = { entries: new Map() };
	inventories.set(readText, inventory);
	return inventory;
}

const decode = Effect.fn("Manifests.decode")(function* (
	readText: ReadText,
	path: string,
): Effect.fn.Return<ManifestEntry | undefined, ManifestReadFailure> {
	const text = yield* readText(path);
	if (text === undefined) {
		return undefined;
	}
	const decoded = decodeManifest(text);
	if (Result.isFailure(decoded)) {
		return yield* new ManifestFailure({ message: `Invalid package manifest: ${decoded.failure.message}`, path });
	}
	return { manifest: decoded.success, text };
});

export const manifestEntry = Effect.fn("Manifests.manifestEntry")(function* (readText: ReadText, path: string) {
	const inventory = inventoryFor(readText);
	const normalized = posix.normalize(path);
	const known = inventory.entries.get(normalized);
	if (known !== undefined) {
		return yield* known;
	}
	const entry = yield* Effect.cached(decode(readText, normalized));
	inventory.entries.set(normalized, entry);
	return yield* entry;
});

export const readPackageManifest = Effect.fn("Manifests.readPackageManifest")(function* (readText: ReadText, path: string) {
	return (yield* manifestEntry(readText, path))?.manifest;
});

export const manifestText = Effect.fn("Manifests.manifestText")(function* (readText: ReadText, path: string) {
	return (yield* manifestEntry(readText, path))?.text;
});

export function manifestFiles(inputs: Pick<RuleInputs, "readText" | "files">): readonly string[] {
	return inventoryFor(inputs.readText).files ?? inputs.files.filter((file) => posix.basename(file) === "package.json");
}

export function setManifestFiles(readText: ReadText, files: readonly string[]): void {
	inventoryFor(readText).files = files;
}

const manifestFailure = Effect.fn("Manifests.manifestFailure")(
	function* (readText: ReadText, file: string) {
		const entry = yield* manifestEntry(readText, file);
		return entry === undefined ? [new ManifestFailure({ message: `required input is missing: ${file}`, path: file })] : [];
	},
	Effect.catchTag("ManifestFailure", (failure) => Effect.succeed([failure])),
);

export const loadPackageManifests = Effect.fn("Manifests.loadPackageManifests")(function* (readText: ReadText, files: readonly string[]) {
	inventoryFor(readText).files = files;
	return (yield* Effect.forEach(files, (file) => manifestFailure(readText, file))).flat();
});

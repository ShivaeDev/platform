import { posix } from "node:path";
import { Data, Result, Schema } from "effect";
import { PackageManifest } from "#PackageManifest.ts";
import type { RuleInputs } from "#rule.ts";

type ReadText = RuleInputs["readText"];

export class ManifestFailure extends Data.TaggedError("ManifestFailure")<{
	readonly message: string;
	readonly path: string;
}> {}

export interface ManifestEntry {
	readonly manifest: PackageManifest;
	readonly text: string;
}

interface ManifestInventory {
	readonly entries: Map<string, Promise<ManifestEntry | undefined>>;
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

async function decode(readText: ReadText, path: string): Promise<ManifestEntry | undefined> {
	const text = await readText(path);
	if (text === undefined) {
		return undefined;
	}
	const decoded = decodeManifest(text);
	if (Result.isFailure(decoded)) {
		throw new ManifestFailure({ message: `Invalid package manifest: ${decoded.failure.message}`, path });
	}
	return { manifest: decoded.success, text };
}

export function manifestEntry(readText: ReadText, path: string): Promise<ManifestEntry | undefined> {
	const inventory = inventoryFor(readText);
	const normalized = posix.normalize(path);
	const entry = inventory.entries.get(normalized) ?? decode(readText, normalized);
	inventory.entries.set(normalized, entry);
	return entry;
}

export async function readPackageManifest(readText: ReadText, path: string): Promise<PackageManifest | undefined> {
	return (await manifestEntry(readText, path))?.manifest;
}

export async function manifestText(readText: ReadText, path: string): Promise<string | undefined> {
	return (await manifestEntry(readText, path))?.text;
}

export function manifestFiles(inputs: Pick<RuleInputs, "readText" | "files">): readonly string[] {
	return inventoryFor(inputs.readText).files ?? inputs.files.filter((file) => posix.basename(file) === "package.json");
}

export function setManifestFiles(readText: ReadText, files: readonly string[]): void {
	inventoryFor(readText).files = files;
}

export async function loadPackageManifests(readText: ReadText, files: readonly string[]): Promise<readonly ManifestFailure[]> {
	inventoryFor(readText).files = files;
	const failures: ManifestFailure[] = [];
	for (const file of files) {
		try {
			await manifestEntry(readText, file);
		} catch (cause) {
			if (!(cause instanceof ManifestFailure)) {
				throw cause;
			}
			failures.push(cause);
		}
	}
	return failures;
}

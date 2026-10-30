import { mkdirSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Schema } from "effect";
import { setManifestFiles } from "#adapters/manifestInventory.ts";
import { services } from "#cli/runMain.ts";
import { collectInventory } from "#inventory/collect.ts";
import { readOptionalText } from "#inventory/filesystem.ts";
import type { Findings, Rule, RuleInputs } from "#rule.ts";
import rawTrees from "#test/fixtures/import-trees.json" with { type: "json" };
import { run } from "#test/run.ts";
import { seedTree } from "./tree.ts";

const SeedFile = Schema.Struct({ content: Schema.String, path: Schema.String });

const trees = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Array(SeedFile)))(rawTrees);

const EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

export function importTree(name: string): string {
	const files = trees[name];
	if (files === undefined) {
		throw new Error(`no import tree named ${name}`);
	}
	return seedTree(files);
}

export function linkWorkspace(root: string, name: string, directory: string): void {
	const link = join(root, "node_modules", name);
	mkdirSync(dirname(link), { recursive: true });
	symlinkSync(join(root, directory), link, "dir");
}

export async function scanned(root: string): Promise<RuleInputs> {
	const inventory = await Effect.runPromise(
		collectInventory(root, { exclude: [], extensions: EXTENSIONS, sources: ["."] }).pipe(Effect.provide(services)),
	);
	const readText: RuleInputs["readText"] = (path) => Effect.runPromise(readOptionalText(join(root, path)).pipe(Effect.provide(NodeFileSystem.layer)));
	setManifestFiles(readText, inventory.manifestFiles);
	return { files: inventory.files, readText, root, sources: inventory.sources };
}

export async function findingsIn<TInput>(rule: Rule<string, TInput>, options: TInput | undefined, root: string): Promise<Findings> {
	const configured = await rule.configure(options);
	if (configured._tag === "Invalid") {
		throw new Error(`invalid options: ${configured.issues.join("; ")}`);
	}
	return run(configured.check(await scanned(root)));
}

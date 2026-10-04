import { mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Schema } from "effect";
import { collectInventory } from "../../src/inventory/collect.ts";
import type { Findings, Rule, RuleInputs } from "../../src/rule.ts";
import rawTrees from "../fixtures/import-trees.json" with { type: "json" };
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

function readText(root: string): RuleInputs["readText"] {
	return (path) => {
		try {
			return Promise.resolve(readFileSync(join(root, path), "utf8"));
		} catch {
			return Promise.resolve(undefined);
		}
	};
}

export async function scanned(root: string): Promise<RuleInputs> {
	const inventory = await Effect.runPromise(
		collectInventory(root, { exclude: [], extensions: EXTENSIONS, sources: ["."] }).pipe(Effect.provide(NodeFileSystem.layer)),
	);
	return { files: inventory.files, readText: readText(root), root, sources: inventory.sources };
}

export async function findingsIn<Input>(rule: Rule<string, Input>, options: Input | undefined, root: string): Promise<Findings> {
	const configured = await rule.configure(options);
	if (configured._tag === "Invalid") {
		throw new Error(`invalid options: ${configured.issues.join("; ")}`);
	}
	return configured.check(await scanned(root));
}

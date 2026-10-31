import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { SeedFile } from "./tree.ts";

export const ROOT_SHARD = "quality-baseline.jsonl";

export const NO_BASELINE_FILE = "no baseline file";

interface StoredEntry {
	readonly count: number;
	readonly path: string;
	readonly rule: string;
}

export function writeAll(root: string, files: readonly SeedFile[]): void {
	for (const file of files) {
		mkdirSync(dirname(join(root, file.path)), { recursive: true });
		writeFileSync(join(root, file.path), file.content);
	}
}

export function sourceOf(lines: number): string {
	return Array.from({ length: lines }, (_, index) => `String(${index});\n`).join("");
}

export function readOrUndefined(root: string, path: string): string | undefined {
	return existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : undefined;
}

function parsed(line: string): StoredEntry | undefined {
	const value: unknown = JSON.parse(line);
	return typeof value === "object" && value !== null && "path" in value && "rule" in value && "count" in value
		? { count: Number(value.count), path: String(value.path), rule: String(value.rule) }
		: undefined;
}

function wordsOf(line: string): string {
	const entry = parsed(line);
	return entry === undefined ? line : `${entry.path} ${entry.rule} ${entry.count}`;
}

// A shard reads as its entries in file order, "src/long.ts structure/max-lines 1", so a story compares debt rather than JSON bytes.
export function recordedDebt(root: string, shard: string): readonly string[] | typeof NO_BASELINE_FILE {
	const text = readOrUndefined(root, shard);
	return text === undefined ? NO_BASELINE_FILE : text.split("\n").filter(Boolean).map(wordsOf);
}

const LINE_KEYS = ["path", "rule", "count"];

function lineOf(entry: StoredEntry): string {
	return `${JSON.stringify(entry, LINE_KEYS)}\n`;
}

export interface ShardEdits {
	readonly adds?: Readonly<Record<string, number>>;
	readonly lowers?: Readonly<Record<string, number>>;
	readonly removes?: readonly string[];
}

export function editsPhrase({ adds = {}, lowers = {}, removes = [] }: ShardEdits): string {
	return [
		...removes.map((name) => `removes ${name}'s entry`),
		...Object.entries(lowers).map(([name, count]) => `lowers ${name} to ${count}`),
		...Object.entries(adds).map(([name, count]) => `adds ${name} at ${count}`),
	].join(" and ");
}

export function editedShard(text: string, folder: string, { adds = {}, lowers = {}, removes = [] }: ShardEdits): string {
	const kept = text
		.split("\n")
		.filter(Boolean)
		.flatMap((line) => parsed(line) ?? [])
		.flatMap((entry) => {
			const name = entry.path.slice(folder.length);
			return removes.includes(name) ? [] : [{ ...entry, count: lowers[name] ?? entry.count }];
		});
	const added = Object.entries(adds).map(([name, count]) => ({ count, path: `${folder}${name}`, rule: "structure/max-lines" }));
	return [...kept, ...added].map(lineOf).join("");
}

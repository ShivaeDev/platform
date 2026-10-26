import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { ChangesetError } from "@shivaedev/releases/error.ts";
import { scanCatalog } from "#quality/catalog.ts";

const STARTER_PATH = "examples/starter/pnpm-workspace.copy.yaml";

const readDrift = Effect.fn("Release.readDrift")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const workspace = scanCatalog(yield* fs.readFileString(join(root, "pnpm-workspace.yaml")));
	const versions = new Map(
		workspace.entries.filter((entry) => entry.section === "catalog" && !entry.namedCatalog).map((entry) => [entry.name, entry.value]),
	);
	const text = yield* fs.readFileString(join(root, STARTER_PATH));
	const drift = scanCatalog(text).entries.flatMap((entry) => {
		const expected = versions.get(entry.name);
		return entry.section === "catalog" && !entry.namedCatalog && expected !== undefined && entry.value !== expected ? [{ ...entry, expected }] : [];
	});
	return { drift, text };
});

export const checkStarterCatalog = Effect.fn("Release.checkStarterCatalog")(function* (root: string) {
	const { drift } = yield* readDrift(root);
	if (drift.length > 0) {
		const messages = drift.map(
			(entry) => `${STARTER_PATH}: catalog entry ${entry.name} pins ${entry.value}, but root pnpm-workspace.yaml pins ${entry.expected}.`,
		);
		return yield* new ChangesetError({
			message: `${messages.join("\n")}\nRun pnpm releases apply for a release, or align these starter catalog entries with the root catalog.`,
		});
	}
});

export const alignStarterCatalog = Effect.fn("Release.alignStarterCatalog")(function* (root: string) {
	const { drift, text } = yield* readDrift(root);
	if (drift.length > 0) {
		const lines = text.split("\n").map((line, index) => {
			const entry = drift.find((candidate) => candidate.line === index + 1);
			return entry === undefined ? line : line.replace(entry.value, entry.expected);
		});
		yield* (yield* FileSystem.FileSystem).writeFileString(join(root, STARTER_PATH), lines.join("\n"));
	}
});

import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Folder, folder } from "#test/board.ts";
import { health } from "#test/diagnostics.ts";
import { healthReadingFolder } from "#test/healthReadingFolder.ts";
import { fleetHealth } from "./fleetHealth.ts";

const folders: Folder[] = [];

afterEach(() => {
	for (const item of folders.splice(0)) {
		item.remove();
	}
});

function notes(source?: string) {
	const result = folder(source === undefined ? {} : { "fleet/health.json": source });
	folders.push(result);
	return result;
}

it.live("reads the shared versioned snapshot and distinguishes missing from invalid Fleet state", function* () {
	expect(yield* fleetHealth(notes(JSON.stringify(health)).root)).toEqual(health);
	expect(yield* fleetHealth(notes().root).pipe(Effect.flip)).toMatchObject({ kind: "not-configured" });
	for (const source of ["broken json", JSON.stringify({ ...health, running: -1 })]) {
		expect(yield* fleetHealth(notes(source).root).pipe(Effect.flip)).toMatchObject({ kind: "error" });
	}
});

it.live("explains an unsupported version before validating its unknown shape", function* () {
	expect(yield* fleetHealth(notes(JSON.stringify({ version: 3 })).root).pipe(Effect.flip)).toMatchObject({
		kind: "error",
		message: "Fleet health snapshot version 3 is not supported by this Board",
	});
});

it.live("rejects outside directories, file symlinks, non-files and oversized snapshots", function* () {
	for (const trait of ["outside-directory", "file-link", "directory-file", "oversized"] as const) {
		const fixture = healthReadingFolder(trait);
		folders.push(fixture);
		expect(yield* fleetHealth(fixture.root).pipe(Effect.flip)).toMatchObject({ kind: "error" });
	}
});

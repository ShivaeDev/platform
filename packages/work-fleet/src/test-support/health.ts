import { mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect, FileSystem, Schema } from "effect";
import { FleetHealth } from "@shivaedev/work-board/diagnostics/health.ts";

export const healthSnapshot: FleetHealth = {
	concurrency: 8,
	lastCapacityRejection: { at: 800, cause: "serverOverloaded" },
	lastSchedulerPass: 900,
	observedAt: 1000,
	queued: 5,
	running: 3,
	staleAfterMs: 60_000,
	version: 2,
	waiting: { automation: 1, maintainer: 2, orchestrator: 3 },
};
export const healthFolder = Effect.fn("FleetStory.healthFolder")(function* (trait: "empty" | "directory" | "file" | "occupied" = "empty") {
	const fs = yield* FileSystem.FileSystem;
	const root = realpathSync(yield* fs.makeTempDirectoryScoped());
	const outside = realpathSync(yield* fs.makeTempDirectoryScoped());
	writeFileSync(join(outside, "health.json"), "Keep this source");
	if (trait === "directory") {
		symlinkSync(outside, join(root, "fleet"));
	} else {
		mkdirSync(join(root, "fleet"));
		if (trait === "file") {
			symlinkSync(join(outside, "health.json"), join(root, "fleet/health.json"));
		}
		if (trait === "occupied") {
			writeFileSync(join(root, "fleet/health.json"), "Authored content");
		}
	}
	return {
		files: () => readdirSync(join(root, "fleet")),
		outside: () => readFileSync(join(outside, "health.json"), "utf8"),
		read: () => Schema.decodeUnknownSync(Schema.fromJsonString(FleetHealth))(readFileSync(join(root, "fleet/health.json"), "utf8")),
		root,
		source: () => readFileSync(join(root, "fleet/health.json"), "utf8"),
		stat: () => statSync(join(root, "fleet/health.json")),
	};
});

export function blockedHealth(root: string) {
	const path = join(root, "fleet/health.json");
	rmSync(path, { force: true });
	mkdirSync(path);
	return () => rmSync(path, { recursive: true });
}

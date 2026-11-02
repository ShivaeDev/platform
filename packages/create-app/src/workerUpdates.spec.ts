import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { updates } from "#test/updates.ts";
import { createdWith010, published010 } from "#test/updateTraits.ts";
import { legacyWorkerRegistry, moduleWorkers } from "#test/workerRegistry.ts";

updates.it(
	"update removes the previous minimal app's worker registry when workers move into application modules",
	[legacyWorkerRegistry, createdWith010("--minimal"), published010, moduleWorkers],
	function* ({ conflictedFiles, exists, exitCode, fileMentions, generationRecord, update }) {
		yield* outcomes([
			["the previous worker registry", () => exists("src/server/workerModules.ts"), true],
			["foundation worker", () => fileMentions("src/server/workerModules.ts", "foundationWorker"), true],
			["notes worker", () => fileMentions("src/server/workerModules.ts", "notesWorker"), false],
		]);

		yield* update();

		yield* outcomes([
			["the obsolete worker registry", () => exists("src/server/workerModules.ts"), false],
			["conflicts", () => conflictedFiles(), []],
			["generation record", () => generationRecord(), { minimal: true, name: "my-app", version: "0.2.0" }],
			["exit code", () => exitCode(), 0],
		]);
	},
);

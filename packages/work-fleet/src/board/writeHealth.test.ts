import { expect } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import { boardFileStory, healthBoundary } from "#test/boardFileStory.ts";
import { healthSnapshot } from "#test/health.ts";

boardFileStory.it("atomically replaces versioned snapshots, retains identical files and cleans temporary files", [], function* ({ health: folder }) {
	yield* folder.publish(healthSnapshot);
	expect(folder.read()).toEqual(healthSnapshot);
	const before = folder.stat();
	yield* folder.publish(healthSnapshot);
	expect(folder.stat().ino).toBe(before.ino);
	expect(folder.stat().mtimeMs).toBe(before.mtimeMs);
	for (let running = 0; running < 20; running += 1) {
		const writing = Effect.runPromise(folder.publish({ ...healthSnapshot, running }));
		expect(folder.read().version).toBe(2);
		yield* Effect.tryPromise(() => writing);
		expect(folder.read().running).toBe(running);
	}
	expect(folder.files()).toEqual(["health.json"]);
});

for (const trait of ["directory", "file", "occupied"] as const) {
	boardFileStory.it(
		`refuses the ${trait} health publication boundary without modifying existing content`,
		[healthBoundary(trait)],
		function* ({ health: folder }) {
			expect(yield* folder.publish(healthSnapshot).pipe(Effect.flip)).toMatchObject({ _tag: "BoardFailure" });
			expect(folder.outside()).toBe("Keep this source");
			if (trait === "occupied") {
				expect(folder.source()).toBe("Authored content");
			}
		},
	);
}

boardFileStory.it("replaces an earlier health snapshot with owner counts", [], function* ({ health: folder }) {
	const fs = yield* FileSystem.FileSystem;
	yield* fs.writeFileString(`${folder.root}/fleet/health.json`, JSON.stringify({ ...healthSnapshot, version: 1, waiting: undefined }));
	yield* folder.publish(healthSnapshot);
	expect(folder.read()).toEqual(healthSnapshot);
});

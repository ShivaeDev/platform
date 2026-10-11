import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { healthFolder, healthSnapshot } from "#test/health.ts";
import { writeHealth } from "./writeHealth.ts";

it.effect("atomically replaces versioned snapshots, retains identical files and cleans temporary files", () =>
	Effect.gen(function* () {
		const folder = yield* healthFolder();
		yield* writeHealth(folder.root, folder.root, healthSnapshot);
		expect(folder.read()).toEqual(healthSnapshot);
		const before = folder.stat();
		yield* writeHealth(folder.root, folder.root, healthSnapshot);
		expect(folder.stat().ino).toBe(before.ino);
		expect(folder.stat().mtimeMs).toBe(before.mtimeMs);
		for (let running = 0; running < 20; running += 1) {
			const writing = Effect.runPromise(writeHealth(folder.root, folder.root, { ...healthSnapshot, running }));
			expect(folder.read().version).toBe(1);
			yield* Effect.tryPromise(() => writing);
			expect(folder.read().running).toBe(running);
		}
		expect(folder.files()).toEqual(["health.json"]);
	}).pipe(Effect.provide(NodeServices.layer)),
);

for (const trait of ["directory", "file", "occupied"] as const) {
	it.effect(`refuses the ${trait} health publication boundary without modifying existing content`, () =>
		Effect.gen(function* () {
			const folder = yield* healthFolder(trait);
			expect(yield* writeHealth(folder.root, folder.root, healthSnapshot).pipe(Effect.flip)).toMatchObject({ _tag: "BoardFailure" });
			expect(folder.outside()).toBe("Keep this source");
			if (trait === "occupied") {
				expect(folder.source()).toBe("Authored content");
			}
		}).pipe(Effect.provide(NodeServices.layer)),
	);
}

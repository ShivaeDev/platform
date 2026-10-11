import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { writeStatus } from "#board/writeStatus.ts";
import { statusFolder, statusRecord } from "#test/status.ts";

it.effect("replaces the generated view only when its content changes and leaves authored task bytes intact", () =>
	Effect.gen(function* () {
		const folder = yield* statusFolder();
		const { root } = folder;
		yield* writeStatus(root, root, [statusRecord("task.one")]);
		const before = folder.stat();
		yield* writeStatus(root, root, [statusRecord("task.one")]);
		expect(folder.stat().ino).toBe(before.ino);
		expect(folder.stat().mtimeMs).toBe(before.mtimeMs);
		yield* writeStatus(root, root, [statusRecord("task.one", "completed")]);
		expect(folder.read()).toContain("Stage: completed");
		expect(folder.taskSource()).toBe(folder.task);
	}).pipe(Effect.provide(NodeServices.layer)),
);

for (const location of ["directory", "file"] as const) {
	it.effect(`rejects a symlink at the status ${location} boundary`, () =>
		Effect.gen(function* () {
			const folder = yield* statusFolder(location);
			const { root } = folder;
			expect(yield* Effect.flip(writeStatus(root, root, [statusRecord("task.one")]))).toMatchObject({ _tag: "BoardFailure" });
			expect(folder.outsideSource()).toBe("Keep this source");
		}).pipe(Effect.provide(NodeServices.layer)),
	);
}

it.effect("refuses to replace an authored task occupying fleet/status.md", () =>
	Effect.gen(function* () {
		const folder = yield* statusFolder("occupied");
		expect(yield* Effect.flip(writeStatus(folder.root, folder.root, [statusRecord("task.one")]))).toMatchObject({ _tag: "BoardFailure" });
		expect(folder.read()).toBe(folder.task);
	}).pipe(Effect.provide(NodeServices.layer)),
);

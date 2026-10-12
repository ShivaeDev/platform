import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { reportFileChanges } from "#host/reportFileChanges.ts";
import { REPORT_ATTACHMENT_DIRECTORY } from "#reportAttachments.ts";
import { addedAttachment } from "#test/reportAttachments.ts";

function change(path: string, type: "update" | "delete", diff: string, movePath: string | null = null) {
	return {
		changes: [{ diff, kind: { "move_path": movePath, type }, path: `${REPORT_ATTACHMENT_DIRECTORY}${path}` }],
		id: `${type}-${path}`,
		type: "fileChange",
	};
}
it.live("replays ordered additions, updates, moves and deletes and ignores unrelated sandbox paths", () =>
	Effect.gen(function* () {
		const result = yield* reportFileChanges(
			[
				addedAttachment("nested/file.txt", "old\n"),
				change("nested/file.txt", "update", "@@ -1 +1 @@\n-old\n+new\n"),
				change("nested/file.txt", "update", "@@ -1 +1 @@\n-new\n+final\n", `${REPORT_ATTACHMENT_DIRECTORY}final.txt`),
				addedAttachment("gone", "gone\n"),
				change("gone", "delete", "gone\n"),
				{ changes: [{ diff: "unrelated", kind: { type: "add" }, path: "/tmp/prototype/file.ts" }], id: "unrelated", type: "fileChange" },
			],
			"",
		);
		expect(result.unavailable).toEqual([]);
		expect(result.files.map(({ path, bytes }) => ({ path, text: new TextDecoder().decode(bytes) }))).toEqual([
			{ path: "final.txt", text: "final\n" },
		]);
	}).pipe(Effect.provide(NodeServices.layer)),
);

it.live("keeps the original attachment path for both null and omitted move targets", () =>
	Effect.gen(function* () {
		const result = yield* reportFileChanges(
			[
				addedAttachment("file.txt", "old\n"),
				change("file.txt", "update", "@@ -1 +1 @@\n-old\n+updated\n"),
				{
					changes: [{ diff: "@@ -1 +1 @@\n-updated\n+final\n", kind: { type: "update" }, path: `${REPORT_ATTACHMENT_DIRECTORY}file.txt` }],
					id: "omitted-move",
					type: "fileChange",
				},
			],
			"",
		);
		expect(result.unavailable).toEqual([]);
		expect(result.files.map(({ path, bytes }) => ({ path, text: new TextDecoder().decode(bytes) }))).toEqual([{ path: "file.txt", text: "final\n" }]);
	}).pipe(Effect.provide(NodeServices.layer)),
);

it.live("retains a good file and records failed updates, unsafe paths and missing promised files", () =>
	Effect.gen(function* () {
		const result = yield* reportFileChanges(
			[
				addedAttachment("good", "safe"),
				addedAttachment("bad", "old\n"),
				change("bad", "update", "@@ -1 +1 @@\n-wrong\n+new\n"),
				addedAttachment("../escape", "escaped"),
				change("no-base", "update", "@@ -1 +1 @@\n-old\n+new\n"),
			],
			"Report\nFLEET_ATTACHMENT: missing\nFLEET_ATTACHMENT: missing",
		);
		expect(result.files.map((file) => file.path)).toEqual(["good"]);
		expect(result.unavailable.map((file) => file.path)).toEqual(["bad", "../escape", "no-base", "missing"]);
	}).pipe(Effect.provide(NodeServices.layer)),
);

it.live("does not replay declined edits, and can re-add a deleted file in the same turn", () =>
	Effect.gen(function* () {
		const result = yield* reportFileChanges(
			[
				{ ...addedAttachment("declined", "not written"), status: "declined" },
				addedAttachment("file", "old"),
				change("file", "delete", "old"),
				addedAttachment("file", "new"),
			],
			"FLEET_ATTACHMENT: declined",
		);
		expect(result.files.map(({ path, bytes }) => ({ path, text: new TextDecoder().decode(bytes) }))).toEqual([{ path: "file", text: "new" }]);
		expect(result.unavailable).toEqual([{ path: "declined", reason: "No file-edit attachment was exposed by this turn" }]);
	}).pipe(Effect.provide(NodeServices.layer)),
);

for (const path of [".git/config", "parent/../file", "link\\file", "file\u0000bad", "nested//file", "./file"]) {
	it.live(`records an unsafe path without reconstructing it: ${JSON.stringify(path)}`, () =>
		Effect.gen(function* () {
			const result = yield* reportFileChanges([addedAttachment(path, "unsafe")], "");
			expect(result.files).toEqual([]);
			expect(result.unavailable).toHaveLength(1);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
}

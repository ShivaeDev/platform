import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { boardSnapshot } from "#board/documents.ts";
import { withBoardReadPass } from "#board/readPass.ts";
import { approvedWorkIds } from "#host/admission.ts";
import { resolveHost } from "#host/config.ts";
import { boardReadStory, hasBoardItems } from "#test/boardReadStory.ts";
import { syntheticDatabase } from "#test/syntheticDatabase.ts";

boardReadStory.it(
	"a file read failure names the source, excludes it from admission and preserves other lookups",
	[hasBoardItems(2)],
	function* ({ board, fixture }) {
		fixture.unreadable.add("1.md");
		yield* withBoardReadPass(
			Effect.gen(function* () {
				expect((yield* board.get("item.0")).approved).toBe(true);
				expect(yield* approvedWorkIds(resolveHost(fixture.root, { database: syntheticDatabase, provider: "local" }))).toEqual(["item.0"]);
				const failed = yield* Effect.result(board.get("item.1"));
				expect(failed._tag).toBe("Failure");
				if (failed._tag === "Failure") {
					expect(failed.failure.message).toContain("Board source could not be read: 1.md");
					expect(failed.failure.message).toContain("PermissionDenied");
				}
			}),
		).pipe(Effect.provide(fixture.services));
		fixture.unreadable.clear();
		expect((yield* board.get("item.1")).approved).toBe(true);
	},
);
boardReadStory.it("a directory scan failure retains the directory and the filesystem problem", [hasBoardItems(1)], function* ({ fixture }) {
	fixture.unreadable.add(".");
	const failed = yield* Effect.result(boardSnapshot(fixture.root, fixture.root)).pipe(Effect.provide(fixture.services));
	expect(failed._tag).toBe("Failure");
	if (failed._tag === "Failure") {
		expect(failed.failure.message).toContain(`Board sources could not be listed: ${fixture.root}`);
		expect(failed.failure.message).toContain("PermissionDenied");
	}
});

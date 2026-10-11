import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { boardSnapshot } from "#board/documents.ts";
import { withBoardReadPass } from "#board/readPass.ts";
import { approvedWorkIds } from "#host/admission.ts";
import { resolveHost } from "#host/config.ts";
import { BoardGateway } from "#policy.ts";
import { boardReads } from "#test/boardReads.ts";

it.effect("a file read failure names the source, excludes it from admission and preserves other lookups", function* () {
	const fixture = yield* boardReads(2);
	fixture.unreadable.add("1.md");
	yield* withBoardReadPass(
		Effect.gen(function* () {
			const board = yield* BoardGateway;
			expect((yield* board.get("item.0")).approved).toBe(true);
			expect(yield* approvedWorkIds(resolveHost(fixture.root, { provider: "local" }))).toEqual(["item.0"]);
			const failed = yield* Effect.result(board.get("item.1"));
			expect(failed._tag).toBe("Failure");
			if (failed._tag === "Failure") {
				expect(failed.failure.message).toContain("Board source could not be read: 1.md");
				expect(failed.failure.message).toContain("PermissionDenied");
			}
		}),
	).pipe(Effect.provide(fixture.board), Effect.provide(fixture.services));
	fixture.unreadable.clear();
	expect(
		(yield* BoardGateway.pipe(
			Effect.flatMap((board) => board.get("item.1")),
			Effect.provide(fixture.board),
		)).approved,
	).toBe(true);
});

it.effect("a directory scan failure retains the directory and the filesystem problem", function* () {
	const fixture = yield* boardReads(1);
	fixture.unreadable.add(".");
	const failed = yield* Effect.result(boardSnapshot(fixture.root, fixture.root)).pipe(Effect.provide(fixture.services));
	expect(failed._tag).toBe("Failure");
	if (failed._tag === "Failure") {
		expect(failed.failure.message).toContain(`Board sources could not be listed: ${fixture.root}`);
		expect(failed.failure.message).toContain("PermissionDenied");
	}
});

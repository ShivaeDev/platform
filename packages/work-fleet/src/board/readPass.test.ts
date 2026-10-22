import { expect } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { vi } from "vitest";
import { board as metadata } from "@shivaedev/work-board/server/integration/board.ts";
import { metadataParse } from "@shivaedev/work-board/server/metadata/parse.ts";
import { briefRevision } from "#board/briefRevision.ts";
import { withBoardReadPass, workMetadata } from "#board/readPass.ts";
import { approvedWorkIds } from "#host/admission.ts";
import { resolveHost } from "#host/config.ts";
import { boardReadStory, hasBoardItems } from "#test/boardReadStory.ts";

boardReadStory.it(
	"100 items share one read and parse per file across listing and concurrent repeated lookups",
	[hasBoardItems(100)],
	function* ({ board, fixture }) {
		const parse = vi.spyOn(metadata, "metadataParse");
		yield* Effect.addFinalizer(() => Effect.sync(() => parse.mockRestore()));
		const started = performance.now();
		yield* withBoardReadPass(
			Effect.gen(function* () {
				yield* Effect.all([board.get("item.0"), board.get("item.1")], { concurrency: "unbounded" });
				const ids = yield* approvedWorkIds(resolveHost(fixture.root, { provider: "local" }));
				expect(ids).toHaveLength(100);
				const readings = yield* Effect.forEach(ids, (id) => Effect.all(Array.from({ length: 8 }, () => board.get(id))), { concurrency: "unbounded" });
				expect(readings).toHaveLength(100);
				for (const [index, items] of readings.entries()) {
					expect(items).toHaveLength(8);
					for (const work of items) {
						expect(work.approved).toBe(true);
						expect(work.revision).toBe(briefRevision(yield* workMetadata(work)));
						expect((yield* workMetadata(work)).fields.id).toBe(ids[index]);
					}
				}
			}),
		).pipe(Effect.provide(fixture.services));
		expect(fixture.scans()).toBe(1);
		expect(fixture.reads.size).toBe(100);
		expect([...fixture.reads.values()]).toEqual(Array.from({ length: 100 }, () => 1));
		expect(parse).toHaveBeenCalledTimes(100);
		expect(performance.now() - started).toBeLessThan(3000);
	},
);
boardReadStory.it(
	"the next pass sees edits, additions, removals and duplicate identities with approval bound to the bytes read",
	[hasBoardItems(2)],
	function* ({ board, fixture }) {
		yield* Effect.gen(function* () {
			const first = yield* withBoardReadPass(
				Effect.gen(function* () {
					const work = yield* board.get("item.0");
					yield* fixture.write("0.md", fixture.source("item.0", false, "Edited work."));
					yield* fixture.remove("1.md");
					yield* fixture.write("new.md", fixture.source("item.new"));
					expect(yield* board.get("item.0")).toEqual(work);
					expect((yield* board.get("item.1")).approved).toBe(true);
					expect((yield* Effect.result(board.get("item.new")))._tag).toBe("Failure");
					return work;
				}),
			);
			yield* withBoardReadPass(
				Effect.gen(function* () {
					const changed = yield* board.get("item.0");
					expect(changed.approved).toBe(false);
					expect(changed.revision).toBe(briefRevision(metadataParse(changed.context)));
					expect(changed.revision).not.toBe(first.revision);
					expect((yield* Effect.result(board.get("item.1")))._tag).toBe("Failure");
					expect((yield* board.get("item.new")).approved).toBe(true);
				}),
			);
			yield* fixture.write("duplicate.md", fixture.source("item.new"));
			expect((yield* withBoardReadPass(Effect.result(board.get("item.new"))))._tag).toBe("Failure");
		});
	},
);
boardReadStory.it("a reconciliation fiber cannot retain an expired pass snapshot", [hasBoardItems(1)], function* ({ board, fixture }) {
	yield* Effect.gen(function* () {
		const release = yield* Deferred.make<void>();
		const pending = yield* withBoardReadPass(
			Effect.gen(function* () {
				yield* board.get("item.0");
				return yield* Deferred.await(release).pipe(Effect.andThen(board.get("item.0")), Effect.forkScoped);
			}),
		);
		yield* fixture.write("0.md", fixture.source("item.0", false));
		yield* Deferred.succeed(release, undefined);
		expect((yield* Fiber.join(pending)).approved).toBe(false);
	});
});
boardReadStory.it(
	"a pass sees its own durable decisions without rescanning and the next pass reads changed work independently",
	[hasBoardItems(1)],
	function* ({ board, fixture }) {
		yield* Effect.gen(function* () {
			const receipt = yield* withBoardReadPass(
				Effect.gen(function* () {
					const decision = { id: "review", links: [], reason: "Review required", recommendation: "Inspect the result" };
					const published = yield* board.decision("item.0", decision);
					expect(yield* board.decision("item.0", decision)).toEqual(published);
					expect(yield* board.readDecision(published)).toEqual({ _tag: "Pending" });
					return published;
				}),
			);
			expect(fixture.scans()).toBe(1);
			expect([...fixture.reads.values()]).toEqual([1]);
			yield* fixture.write("0.md", fixture.source("item.0", true, "Changed after review."));
			yield* withBoardReadPass(
				Effect.gen(function* () {
					expect((yield* board.get("item.0")).revision).not.toBe(receipt.workRevision);
					expect((yield* board.readDecision(receipt))._tag).toBe("Pending");
				}),
			);
		});
	},
);
boardReadStory.it(
	"a pass excludes invalid metadata, shares its named problem and retries it on the next pass",
	[hasBoardItems(1)],
	function* ({ board, fixture }) {
		yield* fixture.write("invalid.md", "---\nid: [\n---\nBroken metadata.");
		yield* Effect.gen(function* () {
			yield* withBoardReadPass(
				Effect.gen(function* () {
					expect((yield* board.get("item.0")).approved).toBe(true);
					expect(yield* approvedWorkIds(resolveHost(fixture.root, { provider: "local" })).pipe(Effect.provide(fixture.services))).toEqual(["item.0"]);
					const missing = yield* Effect.result(board.get("missing"));
					expect(missing._tag).toBe("Failure");
					if (missing._tag === "Failure") {
						expect(missing.failure.message).toContain("Board metadata is invalid: invalid.md (frontmatter: line 3: Flow sequence");
					}
					yield* fixture.remove("invalid.md");
					expect((yield* board.get("item.0")).approved).toBe(true);
				}),
			);
			expect(fixture.scans()).toBe(1);
			expect((yield* withBoardReadPass(board.get("item.0"))).approved).toBe(true);
			expect(fixture.scans()).toBe(2);
		});
	},
);

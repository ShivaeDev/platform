import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { revisionOf } from "@shivaedev/work-board/server/responses/records.ts";
import { boardReadStory, hasBoardItems } from "#test/boardReadStory.ts";
import { refusal } from "#test/refusal.ts";

const LIMIT = 256 * 1024;
const FINDINGS = "# Findings\n\nComplete evidence.\n";
function observation(output: string, turnId = "first") {
	return { execution: "completed", output, provisioning: "unknown", receipt: { sessionId: "worker", turnId } } as const;
}
function bytes(text: string) {
	return new TextEncoder().encode(text).length;
}

boardReadStory.it(
	"a published report reads back in the same pass with its output, revision and source",
	[hasBoardItems(1)],
	function* ({ duringOnePass, read, report, root }) {
		yield* duringOnePass(
			Effect.gen(function* () {
				const published = yield* report(yield* read("item.0"), observation(FINDINGS));

				const readBack = yield* read(published.itemId);
				expect({ context: readBack.context, revision: revisionOf(readBack.context), sourcePath: readBack.sourcePath }).toEqual({
					context: expect.stringMatching(new RegExp(`${FINDINGS}$`, "u")),
					revision: published.revision,
					sourcePath: join(root, published.sourcePath),
				});
			}),
		);
	},
);

boardReadStory.it("republishing the same report returns its first receipt", [hasBoardItems(1)], function* ({ duringOnePass, read, report }) {
	yield* duringOnePass(
		Effect.gen(function* () {
			const work = yield* read("item.0");
			const published = yield* report(work, observation(FINDINGS));

			expect(yield* report(work, observation(FINDINGS))).toEqual(published);
		}),
	);
});

boardReadStory.it(
	"publishing and reading a report within a pass scans the Board once and reads each file once",
	[hasBoardItems(1)],
	function* ({ duringOnePass, read, readsPerFile, report, scans }) {
		yield* duringOnePass(
			Effect.gen(function* () {
				const published = yield* report(yield* read("item.0"), observation(FINDINGS));
				yield* read(published.itemId);
			}),
		);

		yield* outcomes([
			["scans", () => scans(), 1],
			["reads per file", () => readsPerFile(), [1]],
		]);
	},
);

boardReadStory.it(
	"the next pass reads a published report at its revision",
	[hasBoardItems(1)],
	function* ({ duringOnePass, read, readInPass, report }) {
		const published = yield* duringOnePass(Effect.flatMap(read("item.0"), (work) => report(work, observation(FINDINGS))));

		const next = yield* readInPass(published.itemId);

		expect(revisionOf(next.context)).toBe(published.revision);
	},
);

boardReadStory.it(
	"a report of exactly 256 KiB of UTF-8 including metadata and receipt is published",
	[hasBoardItems(1)],
	function* ({ duringOnePass, read, report }) {
		yield* duringOnePass(
			Effect.gen(function* () {
				const work = yield* read("item.0");
				const small = yield* report(work, observation("x"));
				const available = LIMIT - bytes((yield* read(small.itemId)).context) + 1;
				const exact = "界".repeat(Math.floor(available / 3)) + "x".repeat(available % 3);

				const published = yield* report(work, observation(exact, "bound"));

				expect(bytes((yield* read(published.itemId)).context)).toBe(LIMIT);
			}),
		);
	},
);

for (const [size, output] of [
	["one byte over", (exact: string) => `${exact}x`],
	["far over in multibyte text", () => "界".repeat(Math.floor(LIMIT / 3))],
] as const) {
	boardReadStory.it(
		`a report ${size} 256 KiB is refused, naming the limit with its metadata and receipt, and writes nothing`,
		[hasBoardItems(1)],
		function* ({ duringOnePass, read, report, responseFiles }) {
			yield* duringOnePass(
				Effect.gen(function* () {
					const work = yield* read("item.0");
					const small = yield* report(work, observation("x"));
					const available = LIMIT - bytes((yield* read(small.itemId)).context) + 1;
					const exact = "界".repeat(Math.floor(available / 3)) + "x".repeat(available % 3);

					const refused = yield* refusal(report(work, observation(output(exact), "large")));

					expect(refused).toMatch(/256 KiB.*including metadata and receipt/u);
					expect(responseFiles()).toEqual([`${small.itemId}.md`]);
				}),
			);
		},
	);
}

for (const revision of ["authored brief", "saved whole-file"] as const) {
	boardReadStory.it(
		`a report against the ${revision} revision survives a bookkeeping edit and keeps that revision`,
		[hasBoardItems(1)],
		function* ({ read, report, writeSource }) {
			const work = yield* read("item.0");
			const original = { ...work, revision: revision === "saved whole-file" ? revisionOf(work.context) : work.revision };
			yield* writeSource("0.md", original.context.replace("id: item.0", "id: item.0\nstatus: done\nnext_action: Work completed."));

			const published = yield* report(original, observation("Complete findings."));

			expect(published.workRevision).toBe(original.revision);
		},
	);

	boardReadStory.it(
		`a report against the ${revision} revision of a changed brief is refused`,
		[hasBoardItems(1)],
		function* ({ read, report, writeSource }) {
			const work = yield* read("item.0");
			const original = { ...work, revision: revision === "saved whole-file" ? revisionOf(work.context) : work.revision };

			yield* writeSource("0.md", `${original.context}\nChanged scope.\n`);

			expect(yield* refusal(report(original, observation("Stale report.", "stale")))).not.toBe("accepted");
		},
	);
}

boardReadStory.it("a report for a brief whose identity was forged is refused", [hasBoardItems(1)], function* ({ read, report }) {
	const work = yield* read("item.0");

	const forged = yield* refusal(
		report({ ...work, context: work.context.replace("id: item.0", "id: other") }, observation("Forged report.", "forged")),
	);

	expect(forged).not.toBe("accepted");
});

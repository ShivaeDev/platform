import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardReadStory, hasBoardItems } from "#test/boardReadStory.ts";

const REVIEW = { id: "review", links: [], reason: "Review required", recommendation: "Inspect the result" };

boardReadStory.it(
	"a pass keeps previously read briefs through edits and removal while a new identity can be looked up",
	[hasBoardItems(2)],
	function* ({ approvalOf, duringOnePass, edit, read, remove, write }) {
		yield* duringOnePass(
			Effect.gen(function* () {
				const edited = yield* read("item.0");
				yield* read("item.1");

				yield* edit("0.md", "item.0", false, "Edited work.");
				yield* remove("1.md");
				yield* write("new.md", "item.new");

				yield* outcomes([
					["edited item", () => read("item.0"), edited],
					["removed item", () => approvalOf("item.1"), "approved"],
					["added item", () => approvalOf("item.new"), "approved"],
				]);
			}),
		);
	},
);

boardReadStory.it(
	"the next pass sees an edited, a removed and an added file",
	[hasBoardItems(2)],
	function* ({ approvalOf, duringOnePass, edit, read, refusalOf, remove, revisionMatchesMetadata, write }) {
		const original = yield* duringOnePass(read("item.0"));
		yield* edit("0.md", "item.0", false, "Edited work.");
		yield* remove("1.md");
		yield* write("new.md", "item.new");

		const edited = yield* duringOnePass(read("item.0"));

		expect(edited.approved).toBe(false);
		expect(edited.revision).not.toBe(original.revision);
		yield* duringOnePass(
			outcomes([
				["edited revision matches its metadata", () => revisionMatchesMetadata(edited), true],
				["removed item", () => refusalOf("item.1"), expect.not.stringMatching(/^accepted$/u)],
				["added item", () => approvalOf("item.new"), "approved"],
			]),
		);
	},
);

boardReadStory.it("two files claiming one id fail its lookup on the next pass", [hasBoardItems(1)], function* ({ duringOnePass, refusalOf, write }) {
	yield* write("new.md", "item.new");
	expect(yield* duringOnePass(refusalOf("item.new"))).toBe("accepted");

	yield* write("duplicate.md", "item.new");

	expect(yield* duringOnePass(refusalOf("item.new"))).not.toBe("accepted");
});

boardReadStory.it(
	"a fiber that outlives its pass reads the current brief, not the pass snapshot",
	[hasBoardItems(1)],
	function* ({ edit, holdPassAfter, read }) {
		const waiting = yield* holdPassAfter(read("item.0"));
		yield* edit("0.md", "item.0", false);

		const late = yield* waiting.resume();

		expect(late.approved).toBe(false);
	},
);

boardReadStory.it(
	"a decision republished within its pass returns its receipt and reads as pending",
	[hasBoardItems(1)],
	function* ({ decide, decisionState, duringOnePass }) {
		yield* duringOnePass(
			Effect.gen(function* () {
				const published = yield* decide("item.0", REVIEW);

				const republished = yield* decide("item.0", REVIEW);

				expect(republished).toEqual(published);
				expect(yield* decisionState(published)).toBe("pending");
			}),
		);
	},
);

boardReadStory.it(
	"a decision stays pending in the next pass after its work changes",
	[hasBoardItems(1)],
	function* ({ decide, decisionState, duringOnePass, edit, read }) {
		const published = yield* duringOnePass(decide("item.0", REVIEW));

		yield* edit("0.md", "item.0", true, "Changed after review.");

		yield* duringOnePass(
			outcomes([
				["work revision", () => read("item.0").pipe(Effect.map((work) => work.revision === published.workRevision)), false],
				["decision", () => decisionState(published), "pending"],
			]),
		);
	},
);

boardReadStory.it(
	"a file with invalid metadata leaves the valid work approved and listed",
	[hasBoardItems(1)],
	function* ({ approvalOf, approvedIds, duringOnePass, writeSource }) {
		yield* writeSource("invalid.md", "---\nid: [\n---\nBroken metadata.");

		yield* duringOnePass(
			outcomes([
				["valid item", () => approvalOf("item.0"), "approved"],
				["approved work", () => approvedIds(), ["item.0"]],
			]),
		);
	},
);

boardReadStory.it(
	"a lookup for missing work names the file with invalid metadata and its parse problem",
	[hasBoardItems(1)],
	function* ({ duringOnePass, refusalOf, writeSource }) {
		yield* writeSource("invalid.md", "---\nid: [\n---\nBroken metadata.");

		const lookup = yield* duringOnePass(refusalOf("missing"));

		expect(lookup).toContain("Board metadata is invalid: invalid.md (frontmatter: line 3: Flow sequence");
	},
);

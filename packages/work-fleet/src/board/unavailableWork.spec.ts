import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardReadStory, hasBoardItems } from "#test/boardReadStory.ts";

boardReadStory.it(
	"an unreadable file fails its own lookup with the file named",
	[hasBoardItems(2)],
	function* ({ duringOnePass, makeUnreadable, refusalOf }) {
		yield* makeUnreadable("1.md");

		const lookup = yield* duringOnePass(refusalOf("item.1"));

		expect(lookup).toContain("1.md");
	},
);

boardReadStory.it(
	"an unreadable file prevents other identities and complete approved membership from being established",
	[hasBoardItems(2)],
	function* ({ approvedIdsFailure, duringOnePass, makeUnreadable, refusalOf }) {
		yield* makeUnreadable("1.md");

		yield* duringOnePass(
			outcomes([
				["readable item", () => refusalOf("item.0"), expect.stringContaining("1.md")],
				["approved membership", () => approvedIdsFailure(), expect.stringContaining("1.md")],
			]),
		);
	},
);

boardReadStory.it(
	"a file that becomes readable again is approved on the next pass",
	[hasBoardItems(2)],
	function* ({ approvalOf, duringOnePass, makeReadable, makeUnreadable, refusalOf }) {
		yield* makeUnreadable("1.md");
		expect(yield* duringOnePass(refusalOf("item.1"))).not.toBe("accepted");

		yield* makeReadable();

		expect(yield* approvalOf("item.1")).toBe("approved");
	},
);

boardReadStory.it(
	"an unreadable Board folder fails the listing with the folder named",
	[hasBoardItems(1)],
	function* ({ listingFailure, makeUnreadable, root }) {
		yield* makeUnreadable(".");

		const listing = yield* listingFailure();

		expect(listing).toContain(`Board sources could not be read: ${root}`);
		expect(listing).toContain("PermissionDenied");
	},
);

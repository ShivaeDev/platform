import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardReadStory, hasBoardItems } from "#test/boardReadStory.ts";

boardReadStory.it(
	"an unreadable file fails its own lookup with the file and filesystem problem named",
	[hasBoardItems(2)],
	function* ({ duringOnePass, makeUnreadable, refusalOf }) {
		makeUnreadable("1.md");

		const lookup = yield* duringOnePass(refusalOf("item.1"));

		expect(lookup).toMatch(/Board source could not be read: 1\.md.*PermissionDenied/su);
	},
);

boardReadStory.it(
	"an unreadable file leaves the other lookups and approved work in the same pass",
	[hasBoardItems(2)],
	function* ({ approvalOf, approvedIds, duringOnePass, makeUnreadable }) {
		makeUnreadable("1.md");

		yield* duringOnePass(
			outcomes([
				["readable item", () => approvalOf("item.0"), "approved"],
				["approved work", () => approvedIds(), ["item.0"]],
			]),
		);
	},
);

boardReadStory.it(
	"a file that becomes readable again is approved on the next pass",
	[hasBoardItems(2)],
	function* ({ approvalOf, duringOnePass, makeReadable, makeUnreadable, refusalOf }) {
		makeUnreadable("1.md");
		expect(yield* duringOnePass(refusalOf("item.1"))).not.toBe("accepted");

		makeReadable();

		expect(yield* approvalOf("item.1")).toBe("approved");
	},
);

boardReadStory.it(
	"an unreadable Board folder fails the listing with the folder and filesystem problem named",
	[hasBoardItems(1)],
	function* ({ listingFailure, makeUnreadable, root }) {
		makeUnreadable(".");

		const listing = yield* listingFailure();

		expect(listing).toContain(`Board sources could not be listed: ${root}`);
		expect(listing).toContain("PermissionDenied");
	},
);

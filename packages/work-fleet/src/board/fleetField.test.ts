import { describe, expect, it } from "@effect/vitest";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { boardDiagnostics, fleetApproved } from "#board/fleetField.ts";

function parsed(fleet?: string) {
	return metadataParse(`---\nid: one\nkind: task\n${fleet === undefined ? "" : `fleet: ${fleet}\n`}---\n# One\n`);
}

describe("Fleet frontmatter field", () => {
	it("approves only the exact value approved", () => {
		expect(fleetApproved(parsed("approved"))).toBe(true);
		expect(fleetApproved(parsed('"approved"'))).toBe(true);
		expect(fleetApproved(parsed("draft"))).toBe(false);
		expect(fleetApproved(parsed())).toBe(false);
	});

	it("keeps Board diagnostics other than the fleet field", () => {
		expect(boardDiagnostics(parsed("approved"))).toEqual([]);
		expect(boardDiagnostics(metadataParse("---\nid: one\nkind: task\nflavor: sweet\n---\n")).map((diagnostic) => diagnostic.field)).toEqual([
			"flavor",
		]);
	});
});

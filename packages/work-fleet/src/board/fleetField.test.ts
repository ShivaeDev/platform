import { describe, expect, it } from "@effect/vitest";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { boardDiagnostics, fleetApproved, fleetDeliverable, fleetLaunch } from "#board/fleetField.ts";

function parsed(fleet?: string) {
	return metadataParse(`---\nid: one\nkind: task\n${fleet === undefined ? "" : `fleet: ${fleet}\n`}---\n# One\n`);
}

describe("Fleet frontmatter field", () => {
	it("reads report deliverables as Fleet metadata while omitted fields retain the default", () => {
		const report = metadataParse("---\nid: one\nkind: task\nfleet-deliverable: report\n---\n");
		expect(boardDiagnostics(report)).toEqual([]);
		expect(fleetDeliverable(report)).toBe("report");
		expect(fleetDeliverable(parsed())).toBeUndefined();
	});
	it("approves only the exact value approved", () => {
		expect(fleetApproved(parsed("approved"))).toBe(true);
		expect(fleetApproved(parsed('"approved"'))).toBe(true);
		expect(fleetApproved(parsed("draft"))).toBe(false);
		expect(fleetApproved(parsed())).toBe(false);
	});

	it("keeps Board diagnostics other than the fleet field", () => {
		expect(boardDiagnostics(parsed("approved"))).toEqual([]);
		const launch = metadataParse("---\nid: one\nkind: task\nfleet-launch:\n  effort: low\n---\n");
		expect(boardDiagnostics(launch)).toEqual([]);
		expect(fleetLaunch(launch)).toEqual({ effort: "low" });
		expect(boardDiagnostics(metadataParse("---\nid: one\nkind: task\nflavor: sweet\n---\n")).map((diagnostic) => diagnostic.field)).toEqual([
			"flavor",
		]);
	});
});

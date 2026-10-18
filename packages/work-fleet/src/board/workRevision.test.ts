import { expect, it } from "vitest";
import { metadataParse } from "@shivaedev/work-board/server/metadata/parse.ts";
import { revisionOf } from "@shivaedev/work-board/server/responses/records.ts";
import { briefRevision } from "#board/briefRevision.ts";
import { workRevision } from "#board/workRevision.ts";
import { dependencySource } from "#test/dependencyBoard.ts";

it("compares saved whole-file revisions with authored revisions through their exact source", () => {
	const changed = dependencySource.replace("status: planned", "status: done").replace("Implement the work.", "Work completed.");
	expect(workRevision(revisionOf(dependencySource), dependencySource)).toBe(briefRevision(metadataParse(changed)));
	expect(workRevision(revisionOf(changed), changed)).toBe(workRevision(revisionOf(dependencySource), dependencySource));
});

it("keeps authored edits distinct when comparing saved whole-file revisions", () => {
	const changed = dependencySource.replace("The behavior works.", "Different behavior.");
	expect(workRevision(revisionOf(changed), changed)).not.toBe(workRevision(revisionOf(dependencySource), dependencySource));
});

it("retains opaque revisions and revisions whose original source is unavailable", () => {
	const revision = revisionOf(dependencySource);
	expect(workRevision("provider-revision", dependencySource)).toBe("provider-revision");
	expect(workRevision(revision)).toBe(revision);
	expect(workRevision(revision, `${dependencySource}\nDifferent body.\n`)).toBe(revision);
});

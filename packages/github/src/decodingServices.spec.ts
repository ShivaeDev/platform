import { expect } from "vitest";
import { github } from "#test/github.ts";

github.it("a response read uses the caller's service during Schema decoding", [], function* ({ readPullWithPrefix }) {
	expect(yield* readPullWithPrefix("Review: ")).toEqual({ number: 1, title: "Review: Pull request 1" });
});

github.it("a write response uses the caller's service during Schema decoding", [], function* ({ writeIssueWithPrefix }) {
	expect(yield* writeIssueWithPrefix("Repair the build", "Created: ")).toEqual({ number: 6, title: "Created: Repair the build" });
});

import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory } from "#test/boardStory.ts";

boardStory.it("an empty workspace's home page is served", [], function* ({ statusOf }) {
	expect(yield* statusOf("/")).toBe("OK");
});

boardStory.it("an empty workspace's start view offers templates to copy, the report among them", [], function* ({ startTemplates, startView }) {
	yield* outcomes([
		["heading", () => startView(), "Start your workspace"],
		["templates", () => startTemplates(), expect.arrayContaining(["report.md"])],
	]);
});

boardStory.it("opening the start view writes no file into the workspace", [], function* ({ files, startView }) {
	expect(files()).toEqual(["board.sock"]);

	yield* startView();

	expect(files()).toEqual(["board.sock"]);
});

boardStory.it("a missing document in an empty workspace answers Not Found rather than the start view", [], function* ({ statusOf }) {
	expect(yield* statusOf("/missing.md")).toBe("Not Found");
});

boardStory.it("the copied report template reads without diagnostics or recorded evidence", [], function* ({ copyTemplates, documentFindings }) {
	yield* copyTemplates();

	expect(yield* documentFindings("report.md")).toEqual({ diagnostics: [], evidence: "none" });
});

boardStory.it("once the templates are copied, the start view lists them as Templates", [], function* ({ copyTemplates, startView }) {
	expect(yield* startView()).toBe("Start your workspace");

	yield* copyTemplates();

	expect(yield* startView()).toBe("Templates");
});

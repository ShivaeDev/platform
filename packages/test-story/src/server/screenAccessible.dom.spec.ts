import { expect } from "vitest";
import { labelledControl, screenApp } from "#test/screenApp.ts";

screenApp.it("reads the computed label instead of the conflicting aria-label", [labelledControl], ({ accessible, story }) => {
	expect(accessible("#delivery")).toEqual({ name: "Email notifications", role: "switch" });
	expect(story.lines).toContain('read the accessibility of #delivery: {"name":"Email notifications","role":"switch"}');
});

screenApp.it("reads an implicit role and name from native button content", [], ({ accessible }) => {
	expect(accessible("#load")).toEqual({ name: "Load news", role: "button" });
});

screenApp.it("refuses missing and ambiguous accessibility targets", [], ({ accessible }) => {
	expect(() => accessible("#missing")).toThrow("0 matches");
	expect(() => accessible("button")).toThrow("4 matches");
});

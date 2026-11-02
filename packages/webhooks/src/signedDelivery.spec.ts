import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { inbox } from "#test/story.ts";

inbox.it("a fresh timestamped delivery is queued and hands issue 42 to both workers", [], function* ({ answer, deliver, handledJobs }) {
	yield* deliver("a fresh timestamped delivery");

	yield* outcomes([
		["answer", () => answer(), "202 Accepted: queued"],
		["handled jobs", () => handledJobs(), ["webhook-audit for issue 42", "webhook-issue for issue 42"]],
	]);
});

inbox.it("a signed Unicode payload is queued and hands issue 44 to both workers", [], function* ({ answer, deliver, handledJobs }) {
	yield* deliver("a signed issue 44 delivery with Unicode");

	yield* outcomes([
		["answer", () => answer(), "202 Accepted: queued"],
		["handled jobs", () => handledJobs(), ["webhook-audit for issue 44", "webhook-issue for issue 44"]],
	]);
});

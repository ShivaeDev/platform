import { expect, it } from "vitest";
import { runVitest } from "#test/runVitest.ts";

it("registers a conditionally skipped Effect test without executing its body", () => {
	const result = runVitest("skipFixture.ts");
	expect(result.status).toBe(0);
	expect(result.tests.map(({ failureMessages, status, title }) => ({ failureMessages, status, title }))).toEqual([
		{ failureMessages: [], status: "skipped", title: "skips the body behind a true condition" },
		{ failureMessages: [], status: "passed", title: "does not execute the skipped body" },
	]);
}, 60_000);

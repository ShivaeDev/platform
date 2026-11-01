import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { developmentLifecycle } from "#test-support/developmentLifecycle.ts";

developmentLifecycle.it(
	"closing the development server while its optimizer is still building stops Vite and drains both output streams",
	[],
	function* ({ developmentServerCloses, output, serverState, startsWithBlockedOptimizer }) {
		yield* startsWithBlockedOptimizer();
		expect(yield* serverState()).toBe("running");

		yield* developmentServerCloses();

		yield* outcomes([
			["Vite", () => serverState(), "stopped"],
			["stdout", () => output("stdout"), expect.arrayContaining(["development server closed", "development process exited"])],
			["stderr", () => output("stderr"), expect.arrayContaining(["development stderr ended"])],
		]);
	},
);

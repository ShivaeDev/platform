import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { NoteMissing } from "#test/routerClient.ts";
import { loaderFailed, retryTargetsOtherQuery, routes } from "#test/routerStories.tsx";

const failure = new NoteMissing({ id: "first" });

routes.it(
	"a failed route keeps its query after the registry's idle sweep",
	[loaderFailed(failure, "Draft")],
	function* ({ failedQuery, idleWindowPasses }) {
		expect(yield* failedQuery()).toBe("held");

		yield* idleWindowPasses();

		expect(yield* failedQuery()).toBe("held");
	},
);

routes.it(
	"Retry refreshes only the failed route's own query and recovers after the idle sweep",
	[loaderFailed(failure, "Draft", 2)],
	function* ({ alert, clickRetry, heading, idleWindowPasses, requests, serverRecovers }) {
		yield* idleWindowPasses();
		yield* serverRecovers("Recovered second page", 2);
		expect(yield* alert()).toBe("NoteMissing:first");

		yield* clickRetry();

		yield* outcomes([
			["heading", () => heading(), "Recovered second page"],
			["alert", () => alert(), "none"],
			["requests", () => requests(), ["first page 2", "first page 2"]],
		]);
	},
);

routes.it(
	"Retry wired to another query keeps the route's error after the idle sweep even when the server recovers",
	[retryTargetsOtherQuery(), loaderFailed(failure, "Draft")],
	function* ({ alert, clickRetry, heading, idleWindowPasses, requests, serverRecovers }) {
		yield* idleWindowPasses();
		yield* serverRecovers("Recovered note");
		expect(yield* alert()).toBe("NoteMissing:first");

		yield* clickRetry();

		yield* outcomes([
			["heading", () => heading(), "none"],
			["alert", () => alert(), "NoteMissing:first"],
			["requests", () => requests(), ["first page 1"]],
		]);
	},
);

routes.it(
	"leaving the failed route releases its query after the idle sweep",
	[loaderFailed(failure, "Draft")],
	function* ({ failedQuery, heading, idleWindowPasses, leave }) {
		yield* idleWindowPasses();
		expect(yield* failedQuery()).toBe("held");

		yield* leave();
		yield* idleWindowPasses();

		yield* outcomes([
			["heading", () => heading(), "Choose a note you can read"],
			["failed query", () => failedQuery(), "released"],
		]);
	},
);

routes.it(
	"a retry that fails again keeps its query until leaving the route releases it",
	[loaderFailed(failure, "Draft")],
	function* ({ alert, failedQuery, idleWindowPasses, leave, reject, retry }) {
		yield* retry();
		yield* reject("first", failure);
		yield* idleWindowPasses();
		yield* outcomes([
			["alert", () => alert(), "NoteMissing:first"],
			["failed query", () => failedQuery(), "held"],
		]);

		yield* leave();
		yield* idleWindowPasses();

		expect(yield* failedQuery()).toBe("released");
	},
);

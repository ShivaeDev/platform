import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { NoteMissing } from "#test/routerClient.ts";
import { loaderFailed, routes } from "#test/routerStories.tsx";

const failure = new NoteMissing({ id: "first" });

routes.it(
	"a failed loader releases query execution while the route keeps showing its error",
	[loaderFailed(failure, "Draft")],
	function* ({ alert, failedQuery }) {
		yield* outcomes([
			["alert", alert, "NoteMissing:first"],
			["query execution", failedQuery, "released"],
		]);
	},
);

routes.it(
	"Retry reloads the failed route's decoded page after its query execution was released",
	[loaderFailed(failure, "Draft", 2)],
	function* ({ alert, clickRetry, heading, serverRecovers }) {
		yield* serverRecovers("Recovered second page", 2);
		expect(yield* alert()).toBe("NoteMissing:first");

		yield* clickRetry();

		yield* outcomes([
			["heading", heading, "Recovered second page"],
			["alert", alert, "none"],
		]);
	},
);

routes.it(
	"a repeated failure releases query execution and keeps the error visible until navigation",
	[loaderFailed(failure, "Draft")],
	function* ({ alert, failedQuery, heading, leave, reject, retry }) {
		yield* retry();
		yield* reject("first", failure);

		yield* outcomes([
			["alert", alert, "NoteMissing:first"],
			["query execution", failedQuery, "released"],
		]);

		yield* leave();

		expect(yield* heading()).toBe("Choose a note you can read");
	},
);

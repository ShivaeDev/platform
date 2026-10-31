import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { inboxAudienceFixture } from "#test/inboxAudienceFixture.ts";

const plan = [projectFiles({ "plan.md": "# Plan" }), deferredServing];

boardStory.it(
	"the board command listens on a loopback address and serves the folder with the chosen home",
	plan,
	function* ({ commandAddress, commandStarts, httpAnswer, navigationHome }) {
		yield* commandStarts(["--home", "plan.md"]);
		expect(yield* commandAddress()).toBe("a loopback address");

		yield* outcomes({
			"the home": [navigationHome(), "plan.md"],
			"the home page": [httpAnswer("/"), "reading shell"],
		});
	},
);

boardStory.it(
	"the maintainer option decides whom the Inbox asks",
	[projectFiles(inboxAudienceFixture("Casey")), deferredServing],
	function* ({ commandAddress, commandStarts, inboxAudience }) {
		yield* commandStarts(["--maintainer", "Casey"]);

		yield* outcomes({
			address: [commandAddress(), "a loopback address"],
			"inbox audience": [inboxAudience(), { agents: 1, you: 2 }],
		});
	},
);

boardStory.it(
	"a missing home file makes the command fail with an explanation instead of announcing a listener",
	plan,
	function* ({ commandEnding, commandSaid, commandStarts }) {
		yield* commandStarts(["--home", "missing.md"]);

		yield* outcomes({
			"its output": [commandSaid(), expect.stringMatching(/^(?!.*Listening on).*The home file missing\.md is not a markdown file in/su)],
			"the command": [commandEnding(), "failed"],
		});
	},
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	boardStory.it(
		`on ${signal} the command stops promptly despite a live subscription and removes its socket`,
		plan,
		function* ({ clientSubscribes, commandAddress, commandSignalled, commandStarts, commandStopTime, socketFile }) {
			yield* commandStarts();
			expect(yield* commandAddress()).toBe("a loopback address");
			yield* clientSubscribes(undefined, { afterResync: true });
			expect(yield* socketFile()).toBe("owner read-write socket");

			yield* commandSignalled(signal);

			yield* outcomes({
				"the socket": [socketFile(), "missing"],
				"the stop": [commandStopTime(), "within three seconds"],
			});
		},
		10_000,
	);
}

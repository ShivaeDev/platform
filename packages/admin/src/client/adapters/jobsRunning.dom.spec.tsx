import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { jobsScreen, jobsViewOpen } from "#test/jobsScreen.tsx";
import { mailFails, mailHeld, signedInAs } from "#test/jobsStory.ts";

expectNoReactWarnings();

const tokyoTime = expect.stringMatching(/^\d{1,2} \w{3} \d{4}, \d{2}:\d{2}:\d{2} GMT\+9$/u);
const utcInstant = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);

jobsScreen.it(
	"the Running tab lists the held mail with its queue, attempt, start time and time left, and only its failed neighbour under Failed",
	[signedInAs("operator"), mailFails(42), mailHeld, jobsViewOpen],
	function* ({ selectList, shownJobs, shownRunningJobs }) {
		expect((yield* shownJobs()).map(({ job }) => job)).toEqual(["mail 42"]);

		yield* selectList("Running");

		expect(yield* shownRunningJobs()).toEqual([
			{ attempt: "1", job: "the held mail", queue: "mail", started: utcInstant, startedText: tokyoTime, timeLeft: "15m left" },
		]);
	},
);

jobsScreen.it(
	"once the held mail is delivered, refreshing the Running tab shows that nothing runs",
	[signedInAs("operator"), mailHeld, jobsViewOpen],
	function* ({ heldMailFinishes, refresh, screenText, selectList, shownRunningJobs }) {
		yield* selectList("Running");
		expect((yield* shownRunningJobs()).map(({ job }) => job)).toEqual(["the held mail"]);

		yield* heldMailFinishes();
		yield* refresh("Job list");

		yield* outcomes([
			["running jobs", () => shownRunningJobs(), []],
			["screen", () => screenText(), expect.stringContaining("No running jobs.")],
		]);
	},
);

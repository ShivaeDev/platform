import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { assigned, coachingStory, noted, ruleForgotten } from "#test/subject/story.ts";

const coachOfClient = [assigned("coach", "client"), noted("client", "Run 5k", "Slept badly"), noted("coach", "Plan the week")];

coachingStory.it(
	"an assigned coach's browser reads the client's note through the module's default read policy and sees the client's later change live",
	coachOfClient,
	function* ({ shownNote, watchesNote, writesNote }) {
		expect(yield* watchesNote("coach", "client")).toBe("client: Run 5k");

		yield* writesNote("client", "Run 10k");

		expect(yield* shownNote("coach", "client")).toBe("client: Run 10k");
	},
);

coachingStory.it(
	"an assigned coach's write to the client's note is refused with not your client before the handler runs, so the stored note is unchanged",
	coachOfClient,
	function* ({ storedNote, writesNote }) {
		const answer = yield* writesNote("coach", "Skip the run", "client");

		yield* outcomes([
			["answer", () => Effect.succeed(answer), "failed with not your client"],
			["stored note", () => storedNote("client"), "Run 5k"],
		]);
	},
);

coachingStory.it(
	"a stranger with no assignment is refused the client's note and a write to it with not your client, and the stored note is unchanged",
	coachOfClient,
	function* ({ storedNote, watchesNote, writesNote }) {
		yield* outcomes([
			["reading the note", () => watchesNote("stranger", "client"), "failed with not your client"],
			["writing the note", () => writesNote("stranger", "Skip the run", "client"), "failed with not your client"],
			["stored note", () => storedNote("client"), "Run 5k"],
		]);
	},
);

coachingStory.it(
	"after the assignment ends, the coach's view of the client ends with not your client at the client's next change and never shows it, while the coach's own note keeps updating on the same socket",
	coachOfClient,
	function* ({ coachingSocketsOpened, nextShownNote, shownNote, unassigned, watchesNote, writesNote }) {
		yield* outcomes([
			["client's note", () => watchesNote("coach", "client"), "client: Run 5k"],
			["own note", () => watchesNote("coach"), "coach: Plan the week"],
		]);

		yield* unassigned("coach", "client");
		yield* writesNote("client", "Run 10k");

		yield* outcomes([
			["client's note", () => nextShownNote("coach", "client"), "failed with not your client"],
			["own note after writing it", () => writesNote("coach", "Rest day").pipe(Effect.andThen(shownNote("coach"))), "coach: Rest day"],
			["sockets opened", () => coachingSocketsOpened("coach"), 1],
		]);
	},
);

coachingStory.it(
	"after the assignment ends with no change to the client's data, the coach's view keeps the note it had until the revalidation interval, then ends with not your client while the own note still answers",
	coachOfClient,
	function* ({ noteAfterRevalidation, shownNote, unassigned, watchesNote }) {
		yield* outcomes([
			["client's note", () => watchesNote("coach", "client"), "client: Run 5k"],
			["own note", () => watchesNote("coach"), "coach: Plan the week"],
		]);

		yield* unassigned("coach", "client");

		expect(yield* shownNote("coach", "client")).toBe("client: Run 5k");

		yield* outcomes([
			["client's note", () => noteAfterRevalidation("coach", "client"), "failed with not your client"],
			["own note", () => shownNote("coach"), "coach: Plan the week"],
		]);
	},
);

coachingStory.it(
	"the diary query's own check refuses the assigned coach with diary private though the module lets the coach read, while the client reads her diary and a stranger is refused by the module",
	coachOfClient,
	function* ({ opensDiary }) {
		yield* outcomes([
			["the coach", () => opensDiary("coach", "client"), "failed with diary private"],
			["the client", () => opensDiary("client"), "client: Slept badly"],
			["a stranger", () => opensDiary("stranger", "client"), "failed with not your client"],
		]);
	},
);

coachingStory.it(
	"a host serving the coaching module without its delegation rule's service refuses to start, naming the service to provide",
	[ruleForgotten],
	function* ({ startup }) {
		expect(yield* startup()).toBe(
			'A served module names a delegated subject whose rule is the service "@shivaedev/server/test/subject/CoachDelegation", and the host\'s services do not provide it. Add the Layer of the service defined with id "@shivaedev/server/test/subject/CoachDelegation" to the host\'s services.',
		);
	},
);

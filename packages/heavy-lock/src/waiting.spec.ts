import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { heldBy, lockStory, noPollInterval, pollingEvery, waiting } from "#test/kit.ts";

lockStory.it(
	"ready, starting 30s after e2e took the lock, prints that it waits for a pid running e2e's command in e2e's directory since a time of day, and the 30s e2e has held it",
	[heldBy("e2e")],
	function* ({ printedBy, starts, timePasses }) {
		yield* timePasses(30_000);

		yield* starts("ready");

		expect(yield* printedBy("ready")).toEqual(["heavy-process lock: waiting for pid <pid> running `pnpm e2e` in /repo since <time> (30s)"]);
	},
);

lockStory.it(
	"a waiting ready prints nothing more for 55s, then reminds a minute after its first line with the time e2e has held the lock",
	[heldBy("e2e")],
	function* ({ printedBy, starts, timePasses }) {
		yield* timePasses(30_000);
		yield* starts("ready");
		yield* timePasses(55_000);
		expect(yield* printedBy("ready")).toEqual(["heavy-process lock: waiting for pid <pid> running `pnpm e2e` in /repo since <time> (30s)"]);

		yield* timePasses(5000);

		expect(yield* printedBy("ready")).toEqual([
			"heavy-process lock: waiting for pid <pid> running `pnpm e2e` in /repo since <time> (30s)",
			"heavy-process lock: waiting for pid <pid> running `pnpm e2e` in /repo since <time> (1m 30s)",
		]);
	},
);

lockStory.it(
	"when typecheck takes the lock after build, the waiting ready names typecheck at its next poll",
	[heldBy("build"), waiting("ready")],
	function* ({ lock, printedBy, timePasses }) {
		expect(yield* printedBy("ready")).toEqual(["heavy-process lock: waiting for pid <pid> running `pnpm build` in /repo since <time> (0s)"]);

		yield* lock.releases("build");
		yield* lock.tries("typecheck");
		yield* timePasses(10_000);

		expect(yield* printedBy("ready")).toEqual([
			"heavy-process lock: waiting for pid <pid> running `pnpm build` in /repo since <time> (0s)",
			"heavy-process lock: waiting for pid <pid> running `pnpm typecheck` in /repo since <time> (10s)",
		]);
	},
);

for (const { interval, label, trait } of [
	{ interval: 7000, label: "7s", trait: pollingEvery(7000) },
	{ interval: 1000, label: "the default 1s", trait: noPollInterval() },
]) {
	lockStory.it(
		`ready, polling every ${label}, takes build's freed lock only once ${label} has passed since its last attempt`,
		[heldBy("build"), trait, waiting("ready")],
		function* ({ lock, timePasses }) {
			yield* lock.releases("build");
			yield* timePasses(interval - 1);
			expect(yield* lock.holder()).toBe("nobody");

			yield* timePasses(1);

			expect(yield* lock.holder()).toBe("ready");
		},
	);
}

lockStory.it(
	"ready, starting 30s after build took the lock, prints that it waited 10s when it takes the freed lock at its next poll",
	[heldBy("build")],
	function* ({ lock, printedBy, starts, timePasses }) {
		yield* timePasses(30_000);
		yield* starts("ready");
		yield* lock.releases("build");

		yield* timePasses(10_000);

		expect(yield* printedBy("ready")).toEqual([
			"heavy-process lock: waiting for pid <pid> running `pnpm build` in /repo since <time> (30s)",
			"heavy-process lock: acquired after 10s",
		]);
	},
);

lockStory.it(
	"interrupting the waiting ready ends it as interrupted and leaves build's lock with no file of ready's beside it",
	[heldBy("build"), waiting("ready")],
	function* ({ interrupts, lock, stateOf }) {
		yield* interrupts("ready");

		yield* outcomes({
			"files beside the lock": [lock.filesBesideLock(), ["heavy-process.lock"]],
			"lock holder": [lock.holder(), "build"],
			"ready": [stateOf("ready"), "interrupted"],
		});
	},
);

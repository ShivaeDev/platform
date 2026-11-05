import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { waitOnEvents } from "#rules/stories/waitOnEvents.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat, withMatchers } from "#testing/adapters/assertThat.ts";
import { kitFiles } from "#testing/adapters/storySpecFiles.ts";

const SPEC = {
	content: 'import { app } from "#test/index.ts"; app.it("ships", [], function* ({ ship }) { yield* ship(); });',
	path: "src/orders.spec.ts",
};
const KIT = {
	content:
		'import { storyKit } from "@shivaedev/test-story/server/storyKit.ts"; import { ship } from "./wait.ts"; export const orders = storyKit({ verbs: () => ({ ship }) });',
	path: "src/test-support/orders.ts",
};
const SUPPORT = "src/test-support/wait.ts";

for (const [name, imports, body] of [
	["a wall-clock read", "", "Date.now();"],
	["wall-clock polling", "", "while (Date.now() < expires) { await Promise.resolve(); }"],
	["an imported performance clock", 'import { performance as clock } from "node:perf_hooks";', "clock.now();"],
	["a performance clock read", "", "performance.now();"],
	["a current Date", "", "new Date();"],
	["an aliased Effect sleep", 'import { sleep as pause } from "effect/Effect";', 'yield* pause("10 millis");'],
	["a Node sleep", 'import { setTimeout as sleep } from "node:timers/promises";', "await sleep(10);"],
	["a Node scheduler wait", 'import { scheduler } from "node:timers/promises";', "await scheduler.wait(10);"],
	["a namespace scheduler wait", 'import * as timers from "node:timers/promises";', "await timers.scheduler.wait(10);"],
	["an imported timer", 'import { setInterval as poll } from "node:timers";', "poll(ship, 10);"],
	["a namespace timer", 'import * as timers from "node:timers";', "timers.setTimeout(ship, 10);"],
	["a browser timer", "", "window.setTimeout(ship, 10);"],
	["a sleep", 'import { Effect } from "effect";', 'yield* Effect.sleep("50 millis");'],
	["a timer", "", "setTimeout(ship, 10);"],
	["a resolving timer", "", "new Promise((resolve) => { setTimeout(() => resolve(), 10); });"],
	["a global interval", "", "globalThis.setInterval(ship, 10);"],
	["polling", 'import { Effect } from "effect";', 'while (!shipped()) { yield* Effect.sleep("10 millis"); }'],
	["a quiet window", 'import { Effect, Queue } from "effect";', 'yield* Effect.raceFirst(Queue.take(events), Effect.sleep("50 millis"));'],
	[
		"a quiet window that ends successfully",
		'import { Effect } from "effect";',
		'yield* Effect.sleep("50 millis").pipe(Effect.andThen(Effect.succeed("quiet")));',
	],
	["eventually", 'import { eventually as retry } from "@shivaedev/test/eventually.ts";', "yield* retry(shipped);"],
	["fake timers", 'import { vi as clock } from "vitest";', "clock.useFakeTimers();"],
	["advancing fake timers", 'import { vi } from "vitest";', "vi.advanceTimersByTime(1000);"],
	["Vitest polling", 'import { vi } from "vitest";', "yield* Effect.promise(() => vi.waitFor(shipped));"],
] as const) {
	ruleStory.it(
		`tests/wait-on-events reports ${name} in a verb reached through an aliased kit and re-export`,
		[repositoryHas(...kitFiles, SPEC, KIT, { content: `${imports}\nexport function* ship() { ${body} }`, path: SUPPORT })],
		function* ({ check, locations, messages }) {
			yield* check(waitOnEvents);

			yield* withMatchers((expect) =>
				outcomes([
					["locations", () => locations(), [`${SUPPORT}:2`]],
					["advice", () => messages(), [expect.stringContaining("A deadline bounds a failure but does not prove completion")]],
				]),
			);
		},
	);
}

for (const [name, imports, body] of [
	["a pinned Date", "", 'new Date("2026-10-17T12:34:56.000Z");'],
	["the Effect clock", 'import { Clock } from "effect";', "yield* Clock.currentTimeMillis;"],
	["a controlled clock advance", 'import { TestClock } from "effect/testing";', 'yield* TestClock.adjust("1 day");'],
	["setting the controlled clock", 'import * as TestClock from "effect/testing/TestClock";', "yield* TestClock.setTime(0);"],
	["a failing Effect deadline", 'import { Deferred, Effect } from "effect";', 'yield* Deferred.await(done).pipe(Effect.timeout("1 second"));'],
	[
		"a custom failing Effect deadline",
		'import { Deferred, Effect } from "effect";',
		'yield* Deferred.await(done).pipe(Effect.timeoutOrElse({ duration: "1 second", orElse: () => Effect.die("never completed") }));',
	],
	[
		"a sleep that ends in failure",
		'import { Deferred, Effect } from "effect";',
		'yield* Effect.raceFirst(Deferred.await(done), Effect.sleep("1 second").pipe(Effect.andThen(Effect.fail("never completed"))));',
	],
	[
		"a sleep that ends in a defect",
		'import { Deferred, Effect } from "effect";',
		'yield* Effect.raceFirst(Deferred.await(done), Effect.sleep("1 second").pipe(Effect.andThen(() => { return Effect.die("never completed"); })));',
	],
	[
		"an imported rejecting deadline",
		'import { setTimeout as deadline } from "node:timers";',
		'new Promise((resolve, reject) => { completed.on("done", resolve); deadline(reject, 1000, new Error("never completed")); });',
	],
	[
		"a rejecting timer deadline",
		"",
		'new Promise((resolve, reject) => { completed.on("done", resolve); setTimeout(() => { cleanup(); reject(new Error("never completed")); }, 1000); });',
	],
	[
		"a direct rejection deadline",
		"",
		'new Promise((resolve, reject) => { completed.on("done", resolve); globalThis.setTimeout(reject, 1000, new Error("never completed")); });',
	],
] as const) {
	ruleStory.it(
		`tests/wait-on-events accepts ${name} in reachable test-support`,
		[repositoryHas(...kitFiles, SPEC, KIT, { content: `${imports}\nexport function* ship() { ${body} }`, path: SUPPORT })],
		function* ({ check, findings }) {
			yield* check(waitOnEvents);

			yield* assertThat(yield* findings(), (actual) => actual.toEqual([]));
		},
	);
}

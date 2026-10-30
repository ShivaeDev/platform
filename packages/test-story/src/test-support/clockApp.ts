import { Clock, DateTime, Effect, Schema } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { screenDriver } from "#screenDriver.ts";
import { storyKit } from "#storyKit.ts";
import { TimestampReadout } from "./TimestampReadout.ts";
import { timestampHost } from "./timestampHost.ts";
import { timestampScreen } from "./timestampScreen.ts";

export const clockApp = storyKit({
	clock: "live",
	*create() {
		const host = yield* timestampHost;
		const context = yield* Effect.context<never>();
		const root = document.createElement("main");
		document.body.append(root);
		const screen = timestampScreen(root, host.url, Effect.runPromiseWith(context));
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				screen.close();
				root.remove();
			}),
		);
		return { ...host, root, screen };
	},
	name: "clock app",
	stages: [],
	verbs: ({ root, screen, url }, story) => {
		const driver = screenDriver({ pending: screen.pending, root, tell: story.tell });
		function iso(instant: string | number) {
			return DateTime.formatIso(DateTime.makeUnsafe(instant));
		}
		function day(instant: string | number) {
			return DateTime.formatUtc(DateTime.makeUnsafe(instant), { day: "numeric", locale: "en-US", month: "short" });
		}
		function hostReadout() {
			return Effect.promise(async () => {
				story.tell("read the application's HTTP timestamp readout");
				const response = await fetch(url);
				return Schema.decodeUnknownSync(TimestampReadout)(await response.json());
			});
		}
		const runs = { after: 0, before: 0 };
		return {
			aDayPasses: () => TestClock.adjust("1 day"),
			hostInstants: () =>
				Effect.map(hostReadout(), ({ createdAt, hostAt, workerAt }) => ({ createdAt: iso(createdAt), hostAt: iso(hostAt), workerAt: iso(workerAt) })),
			runsTimestampJob: () =>
				Effect.gen(function* () {
					runs.before = yield* Clock.currentTimeMillis;
					yield* driver.click("button");
					yield* driver.settle();
					runs.after = yield* Clock.currentTimeMillis;
				}),
			shownDays: () => Effect.sync(() => ["#host", "#worker", "#screen"].map((readout) => driver.text(readout))),
			timesOfTheRun: () =>
				Effect.gen(function* () {
					const { hostAt, workerAt } = yield* hostReadout();
					const readAt = yield* Clock.currentTimeMillis;
					function sinceTheRun(instant: string) {
						const millis = DateTime.toEpochMillis(DateTime.makeUnsafe(instant));
						return millis >= runs.before && millis <= readAt ? "since the run began" : `outside the run at ${instant}`;
					}
					const shown = driver.text("#screen").replace("Screen: ", "");
					return {
						clock: runs.before === 0 ? "the test clock at the epoch" : "past the epoch",
						hostAt: sinceTheRun(hostAt),
						screenDay: [day(runs.before), day(runs.after)].includes(shown) ? "the run's day" : `not the run's day: ${shown}`,
						workerAt: sinceTheRun(workerAt),
					};
				}),
		};
	},
});

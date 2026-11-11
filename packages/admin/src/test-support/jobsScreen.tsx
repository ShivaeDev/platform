import { Effect, Option } from "effect";
import { act } from "react";
import { vi } from "vitest";
import { activityScreenSignal, isClientIdle } from "@shivaedev/contract/clientActivity.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { render } from "@shivaedev/test-story/client/adapters/react.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { JobsView } from "#client/adapters/JobsView.ts";
import { jobsEngine, postgresConfigured, postgresLayer } from "#test/jobsEngine.ts";
import { idOf, named } from "#test/jobsNames.ts";
import { queues as declarations, Mail } from "#test/jobsPages.ts";
import { type JobsScreenEngine, jobsReadouts, screenOf } from "#test/jobsScreenReadouts.ts";
import { ScheduledWorker } from "#test/ScheduledWorker.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });

function driverFor(engine: JobsScreenEngine, tell: (line: string) => void, settled?: typeof isClientIdle) {
	return screenDriver({ act, activity: activityScreenSignal(engine.activity, settled), root: () => screenOf(engine), tell });
}

export const jobsScreen = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	*create(): Generator<typeof jobsEngine, JobsScreenEngine, never> {
		const engine = yield* jobsEngine;
		return { ...engine, screen: undefined };
	},
	inspect: (engine) => ({ responses: engine.responses, text: engine.screen?.container.textContent }),
	layer: postgresLayer,
	name: "admin jobs screen",
	runIf: postgresConfigured,
	stages: ["session", "jobs", "statistics", "views", "screen"],
	verbs: (engine, story) => {
		const driver = driverFor(engine, story.tell);
		return {
			...jobsReadouts(engine, driver),
			chooseQueue: (name: string) => Effect.andThen(driver.select("select", name), driver.settle()),
			failNextRead: () =>
				Effect.gen(function* () {
					story.tell("the next HTTP read loses its connection");
					const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("The connection closed"));
					yield* Effect.addFinalizer(() => Effect.sync(() => fetch.mockRestore()));
				}),
			nextPage: () => Effect.andThen(driver.click({ name: "Next", role: "button" }), driver.settle()),
			openJob: (name: string) => Effect.andThen(driver.click({ name: engine.ids.get(name) ?? name, role: "button" }), driver.settle()),
			previousPage: () => Effect.andThen(driver.click({ name: "Previous", role: "button" }), driver.settle()),
			refresh: (section: "Jobs health" | "Queue counts" | "Job detail" | "Job list") => {
				const target = section === "Job list" ? '[role="tabpanel"]' : `section[aria-label="${section}"]`;
				return Effect.andThen(driver.within(target).click({ name: "Refresh", role: "button" }), driverFor(engine, story.tell, isClientIdle).settle());
			},
			retrySelected: () => Effect.andThen(driver.click({ name: "Retry job", role: "button" }), driverFor(engine, story.tell, isClientIdle).settle()),
			runSelectedSchedule: () =>
				Effect.andThen(driver.click({ name: "Run now", role: "button" }), driverFor(engine, story.tell, isClientIdle).settle()),
			scheduledRuns: () => Effect.sync(() => [...engine.scheduledRuns]),
			selectList: (name: "Failed" | "Dead-lettered") => Effect.andThen(driver.click({ name, role: "tab" }), driver.settle()),
			sendMail: (id: number) =>
				Effect.gen(function* () {
					story.tell(`enqueue mail ${id}`);
					named(engine, Option.getOrThrow(yield* engine.jobs.enqueue(Mail, { id }, { retryLimit: 0 })), `mail ${id}`);
				}),
			stateOf: (name: string) =>
				engine.client["admin.jobs.job"]({ id: idOf(engine, name), queue: "mail" }).pipe(
					Effect.map((job) => (Option.isSome(job) ? job.value.state : "no job")),
				),
			workersFinish: () => engine.testing.waitForIdle,
		};
	},
});

function openJobsView(namesOnly: boolean) {
	return jobsScreen.trait(
		"screen",
		`the Jobs view opens against the admin HTTP host with queue ${namesOnly ? "names" : "declarations"}`,
		function* (engine) {
			const queues = namesOnly ? declarations.map(({ name }) => name) : declarations;
			engine.screen = yield* Effect.acquireRelease(
				Effect.promise(() =>
					render(
						<JobsView
							api={engine.api}
							queues={queues}
							retry={engine.retryAction}
							runScheduleNow={engine.runScheduleNowAction}
							schedules={[ScheduledWorker]}
						/>,
					),
				),
				(view) => Effect.promise(view.unmount),
			);
			yield* driverFor(engine, () => undefined).settle();
		},
	);
}

export const jobsViewOpen = openJobsView(false);
export const jobsViewOpenWithNames = openJobsView(true);

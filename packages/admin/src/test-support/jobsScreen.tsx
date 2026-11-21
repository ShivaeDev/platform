import { Effect, Option } from "effect";
import { TestClock } from "effect/testing";
import { act } from "react";
import { activityScreenSignal, isClientIdle } from "@shivaedev/contract/clientActivity.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { render } from "@shivaedev/test-story/client/adapters/react.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { JobsView } from "#client/JobsView.ts";
import type { DateDisplay } from "#client/timestampText.ts";
import { browserZone } from "#test/browserZone.ts";
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
			loseNextConnection: () => {
				story.tell("the live connection is lost and the host holds its reconnection");
				return Effect.andThen(engine.host.hold, engine.host.drop);
			},
			nextPage: () => Effect.andThen(driver.click({ name: "Next", role: "button" }), driver.settle()),
			openJob: (name: string) => Effect.andThen(driver.click({ name: engine.ids.get(name) ?? name, role: "button" }), driver.settle()),
			previousPage: () => Effect.andThen(driver.click({ name: "Previous", role: "button" }), driver.settle()),
			reconnects: () => {
				story.tell("the host accepts the held reconnection");
				return Effect.andThen(
					Effect.andThen(engine.host.accept, TestClock.adjust("2 seconds")),
					driverFor(engine, story.tell, isClientIdle).settle(),
				);
			},
			refresh: (section: "Jobs health" | "Queue counts" | "Job detail" | "Job list") => {
				const target = section === "Job list" ? '[role="tabpanel"]' : `section[aria-label="${section}"]`;
				return Effect.andThen(driver.within(target).click({ name: "Refresh", role: "button" }), driverFor(engine, story.tell, isClientIdle).settle());
			},
			refreshWhileReconnecting: (section: "Job list") => {
				story.tell(`refresh the ${section} while its connection is lost`);
				return Effect.andThen(
					driver.within('[role="tabpanel"]').click({ name: "Refresh", role: "button" }),
					Effect.andThen(TestClock.adjust("1 second"), engine.host.held),
				);
			},
			retrySelected: () => Effect.andThen(driver.click({ name: "Retry job", role: "button" }), driver.settle()),
			runSelectedSchedule: () => Effect.andThen(driver.click({ name: "Run now", role: "button" }), driver.settle()),
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

const openView = Effect.fnUntraced(function* (engine: JobsScreenEngine, namesOnly: boolean, dates: DateDisplay) {
	const queues = namesOnly ? declarations.map(({ name }) => name) : declarations;
	engine.screen = yield* Effect.acquireRelease(
		Effect.promise(() =>
			render(
				<JobsView
					{...dates}
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
});

function openJobsView(namesOnly: boolean) {
	return jobsScreen.trait(
		"screen",
		`the Jobs view opens against the admin socket host with queue ${namesOnly ? "names" : "declarations"}, set to British English and Tokyo time`,
		(engine) => openView(engine, namesOnly, { locale: "en-GB", timeZone: "Asia/Tokyo" }),
	);
}

export const jobsViewOpen = openJobsView(false);
export const jobsViewOpenWithNames = openJobsView(true);

export function jobsViewOpenInBrowserZone(timeZone: string) {
	return jobsScreen.trait(
		"screen",
		`the Jobs view opens against the admin socket host in British English with no time zone of its own, in a browser whose time zone is ${timeZone}`,
		function* (engine) {
			yield* browserZone(timeZone);
			yield* openView(engine, false, { locale: "en-GB" });
		},
	);
}

import { Effect, Option } from "effect";
import { act } from "react";
import { activityScreenSignal } from "@shivaedev/contract/clientActivity.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { type Rendered, render } from "@shivaedev/test-story/client/adapters/react.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { JobsView } from "#client/adapters/JobsView.ts";
import { jobsEngine, postgresConfigured, postgresLayer } from "./jobsEngine.ts";
import { idOf, nameOf } from "./jobsNames.ts";
import { pages } from "./jobsPages.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });

type Engine = Effect.Success<typeof jobsEngine> & { screen: Rendered | undefined };

function screenOf(engine: Engine) {
	if (engine.screen === undefined) {
		throw new Error("The jobs screen is not open");
	}
	return engine.screen.container;
}

function driverFor(engine: Engine, tell: (line: string) => void) {
	return screenDriver({ act, pending: activityScreenSignal(engine.activity), root: () => screenOf(engine), tell });
}

export const jobsScreen = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create(): Generator<typeof jobsEngine, Engine, never> {
		const engine = yield* jobsEngine;
		const screen: Rendered | undefined = undefined;
		return { ...engine, screen };
	},
	inspect: (engine) => ({ responses: engine.responses, text: engine.screen?.container.textContent }),
	layer: postgresLayer,
	name: "admin jobs screen",
	runIf: postgresConfigured,
	stages: ["session", "jobs", "statistics", "views", "screen"],
	verbs: (engine, story) => {
		const driver = driverFor(engine, story.tell);
		return {
			alerts: () => Effect.sync(() => [...screenOf(engine).querySelectorAll('[role="alert"]')].map(({ textContent }) => textContent)),
			chooseQueue: (name: string) => Effect.andThen(driver.select("select", name), driver.settle()),
			openJob: (name: string) => Effect.andThen(driver.click({ name: engine.ids.get(name) ?? name, role: "button" }), driver.settle()),
			queueHeading: () => Effect.sync(() => screenOf(engine).querySelector('section[aria-label="Queue counts"] h2')?.textContent),
			retrySelected: () => Effect.andThen(driver.click({ name: "Retry job", role: "button" }), driver.settle()),
			screenText: () => Effect.sync(() => screenOf(engine).textContent),
			selectList: (name: "Failed" | "Dead-lettered") => Effect.andThen(driver.click({ name, role: "tab" }), driver.settle()),
			shownJobs: () =>
				Effect.sync(() =>
					[...screenOf(engine).querySelectorAll("tbody tr")].map((row) => {
						const cells = [...row.querySelectorAll("td > div")].map(({ textContent }) => textContent ?? "");
						return { attempt: cells[2], failure: cells[3], job: nameOf(engine, cells[0] ?? ""), state: cells[1] };
					}),
				),
			shownQueues: () => Effect.sync(() => driver.selection("select").options.map(({ label }) => label)),
			shownSubjectColumns: () => Effect.sync(() => [...screenOf(engine).querySelectorAll("thead th")].slice(4).map(({ textContent }) => textContent)),
			shownSubjects: () =>
				Effect.sync(() => {
					const headings = [...screenOf(engine).querySelectorAll("thead th")].slice(4).map(({ textContent }) => textContent ?? "");
					return [...screenOf(engine).querySelectorAll("tbody tr")].map((row) => {
						const cells = [...row.querySelectorAll("td > div")].map(({ textContent }) => textContent ?? "");
						return {
							job: nameOf(engine, cells[0] ?? ""),
							subject: Object.fromEntries(headings.map((heading, index) => [heading, cells[index + 4]])),
						};
					});
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
			const declarations = pages().pages[0].queues;
			const queues = namesOnly ? declarations.map(({ name }) => name) : declarations;
			engine.screen = yield* Effect.acquireRelease(
				Effect.promise(() => render(<JobsView api={engine.api} queues={queues} retry={engine.retryAction} />)),
				(view) => Effect.promise(view.unmount),
			);
			yield* driverFor(engine, () => undefined).settle();
		},
	);
}

export const jobsViewOpen = openJobsView(false);
export const jobsViewOpenWithNames = openJobsView(true);

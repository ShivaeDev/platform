import { Effect, Option } from "effect";
import { act } from "react";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { type Rendered, render } from "@shivaedev/test-story/client/react.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { JobsView } from "#client/JobsView.ts";
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
	return screenDriver({ act, pending: engine.activity, root: () => screenOf(engine), tell });
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
			chooseQueue: (name: string) =>
				Effect.gen(function* () {
					story.tell(`choose the ${name} queue`);
					const select = screenOf(engine).querySelector("select");
					if (select === null) {
						throw new Error("The jobs queue picker is not rendered");
					}
					yield* Effect.sync(() =>
						act(() => {
							select.value = name;
							select.dispatchEvent(new Event("change", { bubbles: true }));
						}),
					);
					yield* driver.settle();
				}),
			openJob: (name: string) => Effect.andThen(driver.click({ name: engine.ids.get(name) ?? name, role: "button" }), driver.settle()),
			retrySelected: () => Effect.andThen(driver.click({ name: "Retry job", role: "button" }), driver.settle()),
			selectList: (name: "Failed" | "Dead-lettered") => Effect.andThen(driver.click({ name, role: "tab" }), driver.settle()),
			shownJobs: () =>
				Effect.sync(() =>
					[...screenOf(engine).querySelectorAll("tbody tr")].map((row) => {
						const cells = [...row.querySelectorAll("td > div")].map(({ textContent }) => textContent ?? "");
						return { attempt: cells[2], failure: cells[3], job: nameOf(engine, cells[0] ?? ""), state: cells[1] };
					}),
				),
			shownQueues: () => Effect.sync(() => [...screenOf(engine).querySelectorAll("select option")].map(({ textContent }) => textContent)),
			stateOf: (name: string) =>
				engine.client["admin.jobs.job"]({ id: idOf(engine, name), queue: "mail" }).pipe(
					Effect.map((job) => (Option.isSome(job) ? job.value.state : "no job")),
				),
			workersFinish: () => engine.testing.waitForIdle,
		};
	},
});

export const jobsViewOpen = jobsScreen.trait("screen", "the Jobs view opens against the admin HTTP host", function* (engine) {
	engine.screen = yield* Effect.acquireRelease(
		Effect.promise(() => render(<JobsView api={engine.api} queues={pages().pages[0].queues.map(({ name }) => name)} retry={engine.retryAction} />)),
		(view) => Effect.promise(view.unmount),
	);
	yield* driverFor(engine, () => undefined).settle();
});

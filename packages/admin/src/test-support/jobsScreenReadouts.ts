import { Effect } from "effect";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import type { ScreenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import type { jobsEngine } from "#test/jobsEngine.ts";
import { nameOf } from "#test/jobsNames.ts";

export type JobsScreenEngine = Effect.Success<typeof jobsEngine> & { screen: Rendered | undefined };

export function screenOf(engine: JobsScreenEngine) {
	if (engine.screen === undefined) {
		throw new Error("The jobs screen is not open");
	}
	return engine.screen.container;
}

function sectionOf(engine: JobsScreenEngine, label: string) {
	const section = screenOf(engine).querySelector(`section[aria-label="${label}"]`);
	if (section === null) {
		throw new Error(`The ${label} section is not shown`);
	}
	return section;
}

function fieldsIn(root: Element) {
	return Object.fromEntries([...root.querySelectorAll("dt")].map((term) => [term.textContent, term.nextElementSibling?.textContent]));
}

export function jobsReadouts(engine: JobsScreenEngine, driver: ScreenDriver) {
	return {
		alerts: () => Effect.sync(() => [...screenOf(engine).querySelectorAll('[role="alert"]')].map(({ textContent }) => textContent)),
		metrics: (section: "Jobs health" | "Queue counts") => Effect.sync(() => fieldsIn(sectionOf(engine, section))),
		pagination: () =>
			Effect.sync(() => {
				const buttons = [...screenOf(engine).querySelectorAll<HTMLButtonElement>('[role="tabpanel"] button')];
				const next = buttons.find(({ textContent }) => textContent === "Next");
				const previous = buttons.find(({ textContent }) => textContent === "Previous");
				return { nextDisabled: next?.disabled, page: next?.previousElementSibling?.textContent, previousDisabled: previous?.disabled };
			}),
		queueHeading: () => Effect.sync(() => screenOf(engine).querySelector('section[aria-label="Queue counts"] h2')?.textContent),
		screenText: () => Effect.sync(() => screenOf(engine).textContent),
		shownDetail: () =>
			Effect.sync(() => {
				const detail = screenOf(engine).querySelector('section[aria-label$="detail"]');
				if (detail === null) {
					return undefined;
				}
				const fields = fieldsIn(detail);
				const source = [...detail.querySelectorAll("h3")].find(({ textContent }) => textContent === "Dead-letter source");
				const sections = Object.fromEntries(
					[...detail.querySelectorAll("h3")].map((heading) => [heading.textContent, heading.nextElementSibling?.textContent]),
				);
				return {
					failure: sections.Failure,
					fields: { ...fields, "ID": nameOf(engine, fields.ID ?? "") },
					output: JSON.parse(sections.Output ?? ""),
					payload: JSON.parse(sections.Payload ?? ""),
					source: source === undefined ? undefined : nameOf(engine, source.nextElementSibling?.textContent ?? ""),
					sourceOutput: source === undefined ? undefined : JSON.parse(source.nextElementSibling?.nextElementSibling?.textContent ?? ""),
				};
			}),
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
					return { job: nameOf(engine, cells[0] ?? ""), subject: Object.fromEntries(headings.map((heading, index) => [heading, cells[index + 4]])) };
				});
			}),
	};
}

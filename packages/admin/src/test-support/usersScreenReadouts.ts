import { Effect, Option } from "effect";
import type { ScreenDriver } from "@shivaedev/test-story/server/screenDriver.ts";

interface ScreenState {
	readonly container: Option.Option<HTMLElement>;
}

export function screenOf(engine: ScreenState) {
	return Option.getOrThrowWith(engine.container, () => new Error("The users view is not open"));
}

export function rowOf(engine: ScreenState, name: string) {
	const row = [...screenOf(engine).querySelectorAll<HTMLTableRowElement>("tbody tr")].find(
		(candidate) => candidate.querySelector("td > div")?.textContent === name,
	);
	if (row === undefined) {
		throw new Error(`${name} is not shown`);
	}
	return row;
}

export function availability(control: HTMLButtonElement | HTMLSelectElement | null | undefined, missing: string) {
	if (control === null || control === undefined) {
		return missing;
	}
	return control.disabled ? "disabled" : "enabled";
}

export function usersReadouts(engine: ScreenState, driver: ScreenDriver) {
	return {
		roleControl: (name: string) => Effect.sync(() => availability(rowOf(engine, name).querySelector("select"), "no role control")),
		shownNames: () =>
			Effect.sync(() => [...screenOf(engine).querySelectorAll("tbody tr td:first-child > div")].map(({ textContent }) => textContent)),
		shownRole: (name: string) =>
			Effect.sync(() => {
				const row = rowOf(engine, name);
				return row.querySelector("select") === null ? row.querySelectorAll("td > div")[2]?.textContent : driver.within(row).selection("select").value;
			}),
		shownUsers: () =>
			Effect.sync(() =>
				[...screenOf(engine).querySelectorAll<HTMLTableRowElement>("tbody tr")].map((row) => {
					const [name, email, role] = [...row.querySelectorAll<HTMLElement>("td > div")].map((cell) =>
						cell.querySelector("select") === null ? cell.textContent : driver.within(cell).selection("select").value,
					);
					const time = row.querySelector("time");
					return { email, name, role, signedUp: time?.textContent, signedUpDateTime: time?.dateTime };
				}),
			),
	};
}

import { Effect } from "effect";
import { act } from "react";
import { expect } from "vitest";
import { eventually } from "#client/testing.ts";
import type { Application } from "./applicationEngine.ts";
import { getContainer, input } from "./screens.ts";

export function screenVerbs(engine: Application, tell: (line: string) => void) {
	function observe(label: string, read: () => unknown, expected: unknown) {
		tell(`${label} is ${JSON.stringify(expected)}`);
		return Effect.promise(() =>
			eventually(() => {
				const value = read();
				engine.observations[label] = value;
				expect(value, label).toEqual(expected);
			}),
		);
	}
	function click(key: string, name: string) {
		tell(`${key} clicks ${name}`);
		return Effect.promise(async () => {
			const button = [...getContainer(engine, key).querySelectorAll("button")].find((candidate) => candidate.textContent === name);
			if (button === undefined) {
				throw new Error(`Missing button ${name}`);
			}
			await act(async () => button.click());
		});
	}
	function edit(name: string, value: string, key = "editor") {
		tell(`${key} enters ${name} ${value}`);
		return Effect.promise(async () => {
			await act(() => {
				const element = input(engine, name, key);
				Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(element, value);
				element.dispatchEvent(new Event("input", { bubbles: true }));
				element.dispatchEvent(new Event("change", { bubbles: true }));
			});
		});
	}
	return {
		editName: (value: string, key = "editor") => edit("name", value, key),
		editQuantity: (value: string, key = "editor") => edit("quantity", value, key),
		formIsDirty: (key = "editor") =>
			observe(`${key} status`, () => getContainer(engine, key).querySelector('[role="status"]')?.textContent, "Unsaved changes"),
		formIsReady: () => observe("quantity", () => input(engine, "quantity").value, "3"),
		formIsSaved: (key = "editor") =>
			observe(
				`${key} status`,
				() => {
					const container = getContainer(engine, key);
					expect(container.querySelector<HTMLButtonElement>("button")?.disabled, "the saved order's query finished refreshing").toBe(false);
					return container.querySelector('[role="status"]')?.textContent;
				},
				"Saved",
			),
		formShowsError: (message: string) =>
			observe("form error", () => getContainer(engine, "editor").querySelector('[role="alert"]')?.textContent, message),
		listContains: (items: string[]) =>
			observe("list", () => [...getContainer(engine, "list").querySelectorAll("li")].map((li) => li.textContent), items),
		listShows: (text: string) => observe("list", () => getContainer(engine, "list").querySelector("li")?.textContent, text),
		nameDraftIs: (value: string, key = "editor") => observe(`${key} name`, () => input(engine, "name", key).value, value),
		orderIsHidden: (key: string) =>
			observe(
				`${key} cannot see the order`,
				() => {
					const container = getContainer(engine, key);
					expect(container.textContent).not.toContain("Printer paper");
					return Boolean(container.querySelector('[role="alert"]')?.textContent);
				},
				true,
			),
		quantityDraftIs: (value: string, key = "editor") => observe(`${key} quantity`, () => input(engine, "quantity", key).value, value),
		refreshOrder: () => click("editor", "Refresh"),
		renameFromList: () => click("list", "Rename order"),
		revertOrder: () => click("editor", "Revert"),
		serverOrderIs: (text: string, key = "editor") =>
			observe(`${key} server order`, () => getContainer(engine, key).querySelector("output")?.textContent, text),
		submitOrder: (key = "editor") => click(key, "Save"),
	};
}

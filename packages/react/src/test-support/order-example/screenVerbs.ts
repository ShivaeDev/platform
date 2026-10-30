import { Effect } from "effect";
import { act } from "react";
import { eventually } from "@shivaedev/test-story/client/react.ts";
import type { Application } from "./applicationEngine.ts";
import { getContainer, input } from "./screens.ts";

export function screenVerbs(engine: Application, tell: (line: string) => void) {
	function click(key: string, name: string) {
		tell(`${key} clicks ${name}`);
		return Effect.promise(async () => {
			const button = [...getContainer(engine, key).querySelectorAll("button")].find((candidate) => candidate.textContent === name);
			if (button === undefined || button.disabled) {
				throw new Error(`Button ${name} is missing or disabled`);
			}
			await act(async () => button.click());
		});
	}
	function edit(name: string, value: string, key = "editor") {
		tell(`${key} enters ${name} ${value}`);
		return Effect.promise(async () => {
			await act(() => {
				const element = input(engine, name, key);
				const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
				if (setter === undefined) {
					throw new Error("Input value setter is missing");
				}
				setter.call(element, value);
				element.dispatchEvent(new Event("input", { bubbles: true }));
				element.dispatchEvent(new Event("change", { bubbles: true }));
			});
		});
	}
	return {
		editName: (value: string, key = "editor") => edit("name", value, key),
		editor: (key = "editor") => {
			const container = getContainer(engine, key);
			return {
				alert: container.querySelector('[role="alert"]')?.textContent,
				name: container.querySelector<HTMLInputElement>('input[name="name"]')?.value,
				quantity: container.querySelector<HTMLInputElement>('input[name="quantity"]')?.value,
				refreshDisabled: container.querySelector<HTMLButtonElement>("button")?.disabled,
				serverOrder: container.querySelector("output")?.textContent,
				status: container.querySelector('[role="status"]')?.textContent,
				text: container.textContent,
			};
		},
		editQuantity: (value: string, key = "editor") => edit("quantity", value, key),
		list: () => [...getContainer(engine, "list").querySelectorAll("li")].map((li) => li.textContent),
		observe: (line: string, check: () => void) => {
			tell(line);
			return eventually(check);
		},
		refreshOrder: () => click("editor", "Refresh"),
		renameFromList: () => click("list", "Rename order"),
		revertOrder: () => click("editor", "Revert"),
		submitOrder: (key = "editor") => click(key, "Save"),
	};
}

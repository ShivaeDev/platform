import { Effect } from "effect";
import type { Application } from "./applicationEngine.ts";
import { getContainer } from "./screens.ts";

export function screenVerbs(engine: Application, tell: (line: string) => void) {
	function driver(key: string) {
		const screen = engine.screens.get(key);
		if (screen === undefined) {
			throw new Error(`The ${key} screen is not open`);
		}
		return screen.driver;
	}
	function click(key: string, name: string) {
		tell(`${key} clicks ${name}`);
		return driver(key).click({ name, role: "button" });
	}
	function edit(name: string, value: string, key = "editor") {
		tell(`${key} enters ${name} ${value}`);
		return driver(key).enter(`input[name="${name}"]`, value);
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
			return Effect.forEach(engine.screens.values(), (screen) => screen.driver.settle(), { discard: true }).pipe(Effect.andThen(Effect.sync(check)));
		},
		refreshOrder: () => click("editor", "Refresh"),
		renameFromList: () => click("list", "Rename order"),
		revertOrder: () => click("editor", "Revert"),
		submitOrder: (key = "editor") => click(key, "Save"),
	};
}

import { Deferred, Effect } from "effect";
import type { Application } from "./applicationEngine.ts";
import { getContainer } from "./screens.ts";

export function settleOrders(engine: Application) {
	return Effect.forEach(engine.screens.values(), (screen) => screen.driver.settle(), { discard: true });
}

export function screenVerbs(engine: Application, tell: (line: string) => void) {
	function driver(key: string) {
		const screen = engine.screens.get(key);
		if (screen === undefined) {
			throw new Error(`The ${key} screen is not open`);
		}
		return screen.driver;
	}
	function press(key: string, name: string) {
		tell(`${key} clicks ${name}`);
		return driver(key).click({ name, role: "button" });
	}
	function click(key: string, name: string) {
		return press(key, name).pipe(Effect.andThen(settleOrders(engine)));
	}
	function edit(name: string, value: string, key = "editor") {
		tell(`${key} enters ${name} ${JSON.stringify(value)}`);
		return driver(key).enter(`input[name="${name}"]`, value);
	}
	function read(key: string, selector: string) {
		return Effect.sync(() => getContainer(engine, key).querySelector(selector)?.textContent ?? "none");
	}
	return {
		alert: (key = "editor") => read(key, '[role="alert"]'),
		editName: (value: string, key = "editor") => edit("name", value, key),
		editQuantity: (value: string, key = "editor") => edit("quantity", value, key),
		field: (name: "name" | "quantity", key = "editor") =>
			Effect.sync(() => getContainer(engine, key).querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value ?? "missing"),
		list: () => Effect.sync(() => [...getContainer(engine, "list").querySelectorAll("li")].map((li) => li.textContent)),
		refreshOrder: () => click("editor", "Refresh"),
		renameFromList: () => click("list", "Rename order"),
		revertOrder: () => click("editor", "Revert"),
		serverOrder: (key = "editor") => read(key, "output"),
		status: (key = "editor") => read(key, '[role="status"]'),
		submitOrder: (key = "editor") =>
			engine.saves.held
				? press(key, "Save").pipe(
						Effect.andThen(Deferred.await(engine.saves.entered)),
						Effect.andThen(Effect.sync(() => tell("the save waits before writing"))),
					)
				: click(key, "Save"),
	};
}

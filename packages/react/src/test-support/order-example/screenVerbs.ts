import { Deferred, Effect } from "effect";
import { act } from "react";
import { settleScreen } from "#test/settleScreen.ts";
import type { Application } from "./applicationEngine.ts";
import { getContainer, input } from "./screens.ts";

function busy(engine: Application) {
	return [...engine.screens.values()].some(({ container }) => {
		const text = container.textContent ?? "";
		return container.querySelector('[data-pending="true"]') !== null || text.includes("Loading order…") || text.includes("Saving…");
	});
}

export function settleOrders(engine: Application, tell: (line: string) => void) {
	return settleScreen(document.body, () => !engine.saves.holding && busy(engine), tell);
}

export function screenVerbs(engine: Application, tell: (line: string) => void) {
	function click(key: string, name: string) {
		tell(`${key} clicks ${name}`);
		return Effect.promise(async () => {
			const button = [...getContainer(engine, key).querySelectorAll("button")].find((candidate) => candidate.textContent === name);
			if (button === undefined || button.disabled) {
				throw new Error(`Button ${name} is missing or disabled`);
			}
			await act(async () => button.click());
		}).pipe(Effect.andThen(settleOrders(engine, tell)));
	}
	function edit(name: string, value: string, key = "editor") {
		tell(`${key} enters ${name} ${JSON.stringify(value)}`);
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
			Effect.suspend(() => {
				if (!engine.saves.held) {
					return click(key, "Save");
				}
				engine.saves.holding = true;
				return click(key, "Save").pipe(
					Effect.andThen(Deferred.await(engine.saves.entered)),
					Effect.andThen(Effect.sync(() => tell("the save waits before writing"))),
				);
			}),
	};
}

import { type HTMLTemplateElement, Window } from "happy-dom";
import { expect, it } from "vitest";
import { shell } from "./shell.ts";

it("keeps complete Work lists in the source fallback without materializing cards in the React bootstrap", async () => {
	const cards = Array.from({ length: 1500 }, (_, index) => `<article class="work-card" data-item="task-${index}">Work ${index}</article>`).join("");
	const window = new Window();
	try {
		window.document.body.innerHTML = shell("Work", "", cards, "/fixture", true, undefined, true);
		const template = window.document.querySelector<HTMLTemplateElement>("#board-legacy-page");
		expect(template?.content.querySelectorAll(".work-card")).toHaveLength(0);
		expect(template?.content.querySelector("main")?.getAttribute("data-view")).toBe("work");
		expect(window.document.querySelector('noscript [data-item="task-1499"]')).not.toBeNull();
	} finally {
		await window.happyDOM.cancelAsync();
	}
});

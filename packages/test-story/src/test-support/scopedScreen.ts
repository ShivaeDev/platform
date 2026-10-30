import { Effect } from "effect";
import { screenDriver } from "#screenDriver.ts";
import { storyKit } from "#storyKit.ts";

export const scopedScreen = storyKit({
	*create() {
		const root = document.createElement("main");
		for (const name of ["Billing", "Delivery"]) {
			const section = document.createElement("section");
			section.setAttribute("aria-label", name);
			section.innerHTML = '<form aria-label="Address"><input aria-label="City"><button>Save</button></form><output>Unsaved</output>';
			section.addEventListener("submit", (event) => {
				event.preventDefault();
				const output = section.querySelector("output");
				if (output) {
					output.textContent = section.querySelector("input")?.value ?? "";
				}
			});
			root.append(section);
		}
		document.body.append(root);
		yield* Effect.addFinalizer(() => Effect.sync(() => root.remove()));
		return { root };
	},
	name: "scoped screen",
	stages: [],
	verbs: ({ root }, story) => {
		const driver = screenDriver({ pending: () => false, root, tell: story.tell });
		function section(name: "Billing" | "Delivery") {
			return driver.within(`[aria-label="${name}"]`);
		}
		return {
			...driver,
			deliverySection: () => root.querySelector<HTMLElement>('[aria-label="Delivery"]') ?? root,
			enteredCity: (name: "Billing" | "Delivery") => Effect.sync(() => section(name).value("input")),
			savedCity: (name: "Billing" | "Delivery") => Effect.sync(() => section(name).text("output")),
		};
	},
});

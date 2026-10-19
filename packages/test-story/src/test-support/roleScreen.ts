import { Effect } from "effect";
import { screenDriver } from "#screenDriver.ts";
import { storyKit } from "#storyKit.ts";

export const roleScreen = storyKit({
	*create() {
		const root = document.createElement("main");
		root.innerHTML = `<span id="save-label">Save</span>
			<button id="save" aria-labelledby="save-label" aria-label="Ignore this">Commit</button><button id="twin"></button>
			<form aria-label="Profile"><label for="email">Email</label><input id="email" name="email"></form>
			<output aria-label="Result">Ready</output>`;
		document.body.append(root);
		yield* Effect.addFinalizer(() => Effect.sync(() => root.remove()));
		const save = root.querySelector("#save");
		const twin = root.querySelector("#twin");
		const form = root.querySelector("form");
		const output = root.querySelector("output");
		if (!(save && twin && form && output)) {
			throw new Error("The role screen could not mount");
		}
		save.addEventListener("click", () => {
			output.textContent = "Saved";
		});
		twin.addEventListener("click", () => {
			output.textContent = "Wrong button";
		});
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			output.textContent = `Submitted ${new FormData(form).get("email")}`;
		});
		return { root, save };
	},
	inspect: ({ root }) => ({ screen: root.innerText }),
	name: "role screen",
	stages: ["screen"],
	verbs: ({ root, save }, story) => ({
		...screenDriver({ pending: () => false, root, tell: story.tell }),
		saveButton: () => save,
	}),
});

export const duplicateSave = roleScreen.trait("screen", "another visible Save button", ({ root }) => {
	root.insertAdjacentHTML("beforeend", "<button>Save</button>");
});

export function hiddenSave(style: string, ancestor: boolean) {
	return roleScreen.trait("screen", `a Save button ${ancestor ? "inside" : "with"} ${style}`, ({ root }) => {
		const container = document.createElement("div");
		container.innerHTML = "<button>Save</button>";
		const hidden = ancestor ? container : container.firstElementChild;
		if (!(hidden instanceof HTMLElement)) {
			throw new Error("The hidden Save button could not mount");
		}
		if (style === "aria-hidden") {
			hidden.setAttribute("aria-hidden", "true");
		} else if (style === "hidden") {
			hidden.hidden = true;
		} else {
			hidden.style.cssText = style;
		}
		root.append(container);
	});
}

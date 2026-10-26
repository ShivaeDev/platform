import { expect } from "vitest";
import { creates, persistedCreate } from "#test/createStories.ts";

creates.it(
	"restores a draft, clears it on success and resets to initial input",
	[persistedCreate()],
	function* ({ type, reload, create, submit, observe }) {
		yield* type("New order");
		yield* reload();
		expect(create().container.querySelector("input")?.value).toBe("New order");
		yield* submit();
		yield* observe("the initial input returns", () => expect(create().container.querySelector("input")?.value).toBe("Paper"));
		expect(window.localStorage.getItem("create-draft")).toBeNull();
	},
);

creates.it(
	"edits made during a save survive the reset and reload",
	[persistedCreate(true)],
	function* ({ type, submit, observe, create, finishSave, reload }) {
		yield* type("Submitted");
		yield* submit();
		yield* observe("saving", () => expect(create().saving()).toBe(true));
		yield* type("Later edit");
		yield* finishSave();
		yield* observe("later input persists", () => expect(window.localStorage.getItem("create-draft")).toContain("Later edit"));
		yield* reload();
		expect(create().form().values.value.name).toBe("Later edit");
	},
);

for (const direct of [false, true]) {
	creates.it(
		`the ${direct ? "direct hook" : "create adapter"} attaches session ownership`,
		[persistedCreate(false, direct)],
		function* ({ type, show, create }) {
			const key = direct ? "direct-draft" : "create-draft";
			yield* type("First session");
			expect(window.localStorage.getItem(key)).toContain("First session");
			yield* show("second");
			expect(window.localStorage.getItem(key)).toBeNull();
			expect(create().form().values.value.name).toBe("Paper");
		},
	);
}

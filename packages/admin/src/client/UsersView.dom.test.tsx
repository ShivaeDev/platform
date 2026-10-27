import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/react/client/testing.ts";
import { readOnlyAdmin, rejectedRoleChange, usersScreen } from "#test/usersScreen.tsx";

expectNoReactWarnings();

usersScreen.it("renders users and pages through the bound contract", [readOnlyAdmin], function* ({ open, content, click }) {
	yield* open();
	const screen = content();
	yield* eventually(() => expect(screen.textContent).toContain("alice@app.test"));
	expect(screen.textContent).toContain("Alice");
	expect(screen.textContent).toContain("user");
	expect(screen.querySelector("time")?.dateTime).toBe("2026-10-20T12:34:56.000Z");
	expect(screen.querySelector("time")?.textContent).toBe("2026-10-20T12:34:56.000Z");
	expect(screen.querySelector("select")).toBeNull();
	yield* click("nav button:last-child");
	yield* eventually(() => expect(screen.textContent).toContain("bob@app.test"));
	expect(screen.querySelector<HTMLButtonElement>("nav button:last-child")?.disabled).toBe(true);
	yield* click("nav button:first-child");
	yield* eventually(() => expect(screen.textContent).toContain("alice@app.test"));
});

usersScreen.it("assigns any declared role and refreshes the shown role", [], function* ({ open, content, chooseRole, requests }) {
	yield* open();
	const screen = content();
	yield* eventually(() => expect(screen.querySelector("select")).not.toBeNull());
	expect([...screen.querySelectorAll("option")].map((option) => option.value)).toEqual([
		"user",
		"assigner",
		"admin",
		"owner",
		"delegate",
		"auditor",
		"operator",
	]);
	yield* chooseRole("auditor");
	yield* eventually(() => expect(screen.querySelector("select")?.value).toBe("auditor"));
	expect(requests()).toEqual([{ role: "auditor", userId: "alice" }]);
	yield* chooseRole("user");
	yield* eventually(() => expect(screen.querySelector("select")?.value).toBe("user"));
	expect(requests()[1]).toEqual({ role: "user", userId: "alice" });
});

for (const [reason, message] of [
	["last", "The last user who can assign roles cannot be removed"],
	["forbidden", "Permission required to assign roles"],
] as const) {
	usersScreen.it(`shows the server's ${reason} role refusal`, [rejectedRoleChange(reason)], function* ({ open, content, chooseRole }) {
		yield* open();
		const screen = content();
		yield* eventually(() => expect(screen.querySelector("select")).not.toBeNull());
		yield* chooseRole("admin");
		yield* eventually(() => expect(screen.querySelector('[role="alert"]')?.textContent).toContain(message));
		expect(screen.querySelector("select")?.value).toBe("user");
	});
}

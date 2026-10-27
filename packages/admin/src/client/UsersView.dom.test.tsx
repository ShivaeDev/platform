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
	expect(screen.querySelector("input")).toBeNull();
	yield* click("nav button:last-child");
	yield* eventually(() => expect(screen.textContent).toContain("bob@app.test"));
	expect(screen.querySelector<HTMLButtonElement>("nav button:last-child")?.disabled).toBe(true);
	yield* click("nav button:first-child");
	yield* eventually(() => expect(screen.textContent).toContain("alice@app.test"));
});

usersScreen.it("sends grants and revocations and refreshes the shown role", [], function* ({ open, content, click, requests }) {
	yield* open();
	const screen = content();
	const selector = 'input[aria-label="admin for alice@app.test"]';
	yield* eventually(() => expect(screen.querySelector(selector)).not.toBeNull());
	yield* click(selector);
	yield* eventually(() => expect(screen.querySelector<HTMLInputElement>(selector)?.checked).toBe(true));
	expect(requests()).toEqual([{ grant: true, role: "admin", userId: "alice" }]);
	yield* click(selector);
	yield* eventually(() => expect(screen.querySelector<HTMLInputElement>(selector)?.checked).toBe(false));
	expect(requests()[1]).toEqual({ grant: false, role: "admin", userId: "alice" });
});

for (const [reason, message] of [
	["last", "The last owner cannot be demoted"],
	["forbidden", "Owner role required"],
] as const) {
	usersScreen.it(`shows the server's ${reason} role refusal`, [rejectedRoleChange(reason)], function* ({ open, content, click }) {
		yield* open();
		const screen = content();
		yield* eventually(() => expect(screen.querySelector("input")).not.toBeNull());
		yield* click('input[aria-label="admin for alice@app.test"]');
		yield* eventually(() => expect(screen.querySelector('[role="alert"]')?.textContent).toContain(message));
		expect(screen.querySelector<HTMLInputElement>('input[aria-label="admin for alice@app.test"]')?.checked).toBe(false);
	});
}

import { expect } from "vitest";
import { browser } from "#test/browser.ts";

browser.it("captures each requested page and reports successful visible-text smoke checks", [], function* ({ run, screenshot, visits }) {
	const result = yield* run(["--page", "/", "--page", "/notes", "--text", "Local app"]);

	expect(result.code, result.output).toBe(0);
	expect(result.output).toContain("smoke passed");
	expect(visits()).toEqual(expect.arrayContaining(["/", "/notes"]));
	for (const index of [1, 2]) {
		const png = screenshot(index);
		expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
	}
});

browser.it("signs in with test-user credentials and carries the session to the page", [], function* ({ run, signIns }) {
	const result = yield* run(["--page", "/account", "--text", "Alice's account"], {
		"BROWSER_CHECK_EMAIL": "alice@example.com",
		"BROWSER_CHECK_PASSWORD": "alice-password",
	});

	expect(result.code, result.output).toBe(0);
	expect(signIns()).toEqual([{ email: "alice@example.com", password: "alice-password" }]);
});

for (const [name, args, output] of [
	["live notes without disposable-user credentials", ["--live-notes"], "--live-notes requires BROWSER_CHECK_EMAIL and BROWSER_CHECK_PASSWORD"],
	["unsuccessful HTTP response", ["--page", "/missing"], "returned HTTP 404"],
	["missing visible text", ["--text", "Text absent from the app"], "Timeout"],
] as const) {
	browser.it(`fails a smoke run for ${name}`, [], function* ({ run }) {
		const result = yield* run(args);

		expect(result.code, result.output).not.toBe(0);
		expect(result.output).toContain(output);
	});
}

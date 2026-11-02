import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { refusal, refusalOf } from "#test/attempt.ts";
import { memberDialogs, twoMembers } from "#test/memberDialogs.tsx";

for (const kind of ["native", "dialog", "alertdialog"] as const) {
	memberDialogs.it(`ada cannot read or click grace's ${kind}`, [twoMembers(kind)], function* ({ as }) {
		const ada = as("ada");

		yield* outcomes([
			[
				"read grace's dialog by selector",
				() => refusalOf(() => ada.text('[data-owner="grace"]')),
				'threw: The screen has 0 matches for "[data-owner=\\"grace\\"]".',
			],
			[
				"read grace's dialog by role",
				() => refusalOf(() => ada.text({ name: "grace's preferences", role: kind === "native" ? "dialog" : kind })),
				`threw: The screen has 0 matches for ${kind === "native" ? "dialog" : kind} named "grace's preferences".`,
			],
			[
				"click grace's dialog button",
				() => refusal(ada.click({ name: "Dismiss grace", role: "button" })),
				'died: The screen has 0 matches for button named "Dismiss grace".',
			],
		]);
	});

	memberDialogs.it(`ada finds and clicks her own ${kind} while grace has an identical button`, [twoMembers(kind)], function* ({ as, saved }) {
		const ada = as("ada");
		const dialog = yield* ada.find({ name: "ada's preferences", role: kind === "native" ? "dialog" : kind });
		expect(ada.text('[data-owner="ada"]')).toContain("ada's private preferences");
		expect(dialog.textContent).toContain("ada's private preferences");
		expect(yield* saved("ada")).toBe("Unsaved");

		yield* ada.click({ name: "Confirm", role: "button" });

		yield* outcomes([
			["ada's screen", () => saved("ada"), "Saved"],
			["grace's screen", () => saved("grace"), "Unsaved"],
		]);
	});
}

for (const kind of ["native", "dialog", "alertdialog"] as const) {
	memberDialogs.it(`dismissing ada's body portal ${kind} leaves her driver unable to read grace's`, [twoMembers(kind, "body")], function* ({ as }) {
		const ada = as("ada").dialog({ name: "Preferences", role: kind === "native" ? "dialog" : kind });
		expect(ada.text()).toContain("ada's private preferences");

		yield* ada.click({ name: "Dismiss ada", role: "button" });

		expect(yield* refusalOf(() => ada.text())).toBe(
			`threw: The screen has 0 dialogs for ${kind === "native" ? "dialog" : kind} named "Preferences".`,
		);
	});

	memberDialogs.it(`ada's body portal ${kind} driver reads and confirms only her preferences`, [twoMembers(kind, "body")], function* ({ as, saved }) {
		const target = { name: "Preferences", role: kind === "native" ? "dialog" : kind };
		const ada = as("ada").within("main").dialog(target);
		expect(ada.text()).toContain("ada's private preferences");
		expect(ada.text()).not.toContain("grace's private preferences");
		expect(yield* saved("ada")).toBe("Unsaved");

		yield* ada.click({ name: "Confirm", role: "button" });

		yield* outcomes([
			["ada's screen", () => saved("ada"), "Saved"],
			["grace's screen", () => saved("grace"), "Unsaved"],
		]);
	});

	memberDialogs.it(`ada's body portal ${kind} driver cannot reach grace's dialog`, [twoMembers(kind, "body")], function* ({ as }) {
		const ada = as("ada").dialog({ name: "Preferences", role: kind === "native" ? "dialog" : kind });

		yield* outcomes([
			[
				"read grace's dialog",
				() => refusalOf(() => ada.text('[data-owner="grace"]')),
				'threw: The screen has 0 matches for "[data-owner=\\"grace\\"]".',
			],
			[
				"click grace's button",
				() => refusal(ada.click({ name: "Dismiss grace", role: "button" })),
				'died: The screen has 0 matches for button named "Dismiss grace".',
			],
			[
				"open grace's dialog driver",
				() => refusalOf(() => ada.dialog('[data-owner="grace"]')),
				'threw: The screen has 0 dialogs for [data-owner="grace"].',
			],
		]);
	});
}

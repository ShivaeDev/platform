import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { launchControl, launchPending, ownership } from "#test/action-ownership/story.tsx";

for (const mode of ["native", "runtime"] as const) {
	ownership.it(
		`${mode}: Launch shows its own refusal and replacing it clears that refusal`,
		[launchPending(mode)],
		function* ({ alert, cause, reject, switchCommand }) {
			yield* reject("Launch", "Launch was refused");

			expect(yield* alert()).toBe("Launch was refused");

			yield* switchCommand("Resume");

			yield* outcomes([
				["alert", () => alert(), ""],
				["cause", () => cause(), "none"],
			]);
		},
	);

	ownership.it(
		`${mode}: replacing Launch with Resume keeps the control disabled until Launch settles and hides its refusal`,
		[launchControl(mode)],
		function* ({ alert, cause, control, dispatch, reject, switchCommand }) {
			expect(yield* control()).toEqual({ label: "Launch", state: "enabled" });

			yield* dispatch();

			expect(yield* control()).toEqual({ label: "Launch", state: "disabled" });

			yield* switchCommand("Resume");

			expect(yield* control()).toEqual({ label: "Resume", state: "disabled" });

			yield* reject("Launch", "The old action was refused");

			yield* outcomes([
				["control", () => control(), { label: "Resume", state: "enabled" }],
				["alert", () => alert(), ""],
				["cause", () => cause(), "none"],
			]);
		},
	);

	ownership.it(
		`${mode}: Resume sends its own input and shows its own result after Launch is refused`,
		[launchPending(mode)],
		function* ({ complete, dispatch, reject, sent, shown, switchCommand }) {
			yield* switchCommand("Resume");
			yield* reject("Launch", "The old action was refused");

			yield* dispatch();
			yield* complete("Resume", "Resumed the shoals");

			yield* outcomes([
				[
					"sent commands",
					() => sent(),
					[
						{ command: "Launch", input: "the-reef" },
						{ command: "Resume", input: "the-shoals" },
					],
				],
				["shown result", () => shown(), "Resumed the shoals"],
			]);
		},
	);

	ownership.it(`${mode}: Launch's success never appears on Resume`, [launchPending(mode)], function* ({ complete, shown, switchCommand }) {
		yield* switchCommand("Resume");

		yield* complete("Launch", "Launched the reef");

		expect(yield* shown()).toBe("");
	});

	ownership.it(
		`${mode}: another replacement keeps Launch pending until its answer`,
		[launchPending(mode)],
		function* ({ control, reject, switchCommand }) {
			yield* switchCommand("Resume");
			yield* switchCommand("Inspect");

			expect(yield* control()).toEqual({ label: "Inspect", state: "disabled" });

			yield* reject("Launch", "The old action was refused");

			expect(yield* control()).toEqual({ label: "Inspect", state: "enabled" });
		},
	);
}

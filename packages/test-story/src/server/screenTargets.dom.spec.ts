import { Cause, Effect, Exit } from "effect";
import { expect } from "vitest";
import { hiddenScreen, inertForm, screenApp } from "#test/screenApp.ts";

for (const style of ["display: none", "visibility: hidden", "content-visibility: hidden", "hidden"]) {
	for (const ancestor of [false, true]) {
		screenApp.it(
			`refuses actions and readouts when ${ancestor ? "an ancestor has" : "targets have"} ${style}`,
			[hiddenScreen(style, ancestor)],
			function* ({ click, enter, submit, text, value }) {
				for (const action of [click("#load"), enter('[name="email"]', "alice@example.test"), enter("textarea", "draft"), submit()]) {
					const exit = yield* Effect.exit(action);
					expect(Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "acted").toContain("is not rendered");
				}
				expect(() => text("output")).toThrow("is not rendered");
				expect(() => value('[name="email"]')).toThrow("is not rendered");
				expect(() => value("textarea")).toThrow("is not rendered");
				if (ancestor) {
					expect(() => text()).toThrow("is not rendered");
				}
			},
		);
	}
}

screenApp.it("refuses submission through an inert ancestor", [inertForm], function* ({ submit }) {
	const exit = yield* Effect.exit(submit());
	expect(Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "submitted").toContain("is disabled");
});

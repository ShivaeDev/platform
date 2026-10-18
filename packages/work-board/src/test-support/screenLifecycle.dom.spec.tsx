import { Effect, Exit } from "effect";
import { expect, vi } from "vitest";
import { render } from "@shivaedev/effect-react/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import { createScreen, type ScreenEngine, trackScreen } from "./screenEngine.ts";

for (const fails of [false, true]) {
	it.live(`unmounts the screen and retains what the reader saw after ${fails ? "failure" : "success"}`, function* () {
		const lease: { engine?: ScreenEngine; container?: HTMLElement } = {};
		const exit = yield* Effect.gen(function* () {
			const engine = yield* createScreen();
			lease.engine = engine;
			const view = trackScreen(
				engine,
				yield* Effect.promise(() =>
					render(
						<label>
							Direction
							<input defaultValue="Use local files" name="answer" />
						</label>,
					),
				),
				() => undefined,
			);
			lease.container = view.container;
			window.localStorage.setItem("draft", "Use local files");
			if (fails) {
				return yield* Effect.fail("the reader's assertion failed");
			}
		}).pipe(Effect.scoped, Effect.exit);
		expect(Exit.isFailure(exit)).toBe(fails);
		expect(lease.container?.isConnected).toBe(false);
		expect(lease.engine?.lastView).toMatchObject({
			controls: [{ name: "answer", value: "Use local files" }],
			storage: { draft: "Use local files" },
			text: "Direction",
		});
		vi.unstubAllGlobals();
	});
}

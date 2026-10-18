import { Effect, Exit } from "effect";
import { expect, vi } from "vitest";
import { render } from "@shivaedev/effect-react/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import { createScreen, type ScreenEngine, trackScreen } from "./screenEngine.ts";

for (const mounts of [1, 4]) {
	for (const completion of ["success", "failure", "failure after closing", "finalizer failure"]) {
		it.live(`unmounts ${mounts} screens and retains the latest view through ${completion}`, function* () {
			const lease: { containers: HTMLElement[]; engine?: ScreenEngine } = { containers: [] };
			const exit = yield* Effect.gen(function* () {
				if (completion === "finalizer failure") {
					yield* Effect.addFinalizer(() => Effect.die("a later finalizer failed"));
				}
				const engine = yield* createScreen();
				lease.engine = engine;
				for (let index = 1; index < mounts; index += 1) {
					const earlier = trackScreen(engine, yield* Effect.promise(() => render(<p>Earlier screen {index}</p>)), () => undefined);
					lease.containers.push(earlier.container);
				}
				const rendered = yield* Effect.promise(() =>
					render(
						<label>
							Direction
							<input defaultValue="Use local files" name="answer" />
						</label>,
					),
				);
				const view = trackScreen(engine, rendered, () => undefined);
				lease.containers.push(view.container);
				window.localStorage.setItem("draft", "Use local files");
				if (completion === "failure after closing") {
					yield* Effect.promise(view.unmount);
				}
				if (completion === "failure" || completion === "failure after closing") {
					return yield* Effect.fail("the reader's assertion failed");
				}
			}).pipe(Effect.scoped, Effect.exit);
			expect(Exit.isFailure(exit)).toBe(completion !== "success");
			for (const container of lease.containers) {
				expect(container.isConnected).toBe(false);
			}
			expect(lease.engine?.lastView).toMatchObject({
				controls: [{ name: "answer", value: "Use local files" }],
				storage: { draft: "Use local files" },
				text: "Direction",
			});
			vi.unstubAllGlobals();
		});
	}
}

import { Effect, Exit } from "effect";
import { expect } from "vitest";
import { failingScreenFinalizer, screenScopeStory } from "#test/screenScopeStory.ts";

for (const mounts of [1, 4]) {
	for (const completion of ["success", "failure", "failure after closing", "finalizer failure"]) {
		screenScopeStory.it(
			`unmounts ${mounts} screens and retains the latest view through ${completion}`,
			completion === "finalizer failure" ? [failingScreenFinalizer()] : [],
			function* ({ mount, close, snapshot }) {
				const containers: HTMLElement[] = [];
				for (let index = 1; index < mounts; index += 1) {
					const earlier = yield* mount(<p>Earlier screen {index}</p>);
					containers.push(earlier.container);
				}
				const view = yield* mount(
					<label>
						Direction
						<input defaultValue="Use local files" name="answer" />
					</label>,
				);
				containers.push(view.container);
				window.localStorage.setItem("draft", "Use local files");
				if (completion === "failure after closing") {
					yield* Effect.promise(view.unmount);
				}
				const exit = yield* Effect.gen(function* () {
					if (completion === "failure" || completion === "failure after closing") {
						return yield* Effect.fail("the reader's assertion failed");
					}
				}).pipe(Effect.onExit(close), Effect.exit);
				expect(Exit.isFailure(exit)).toBe(completion !== "success");
				for (const container of containers) {
					expect(container.isConnected).toBe(false);
				}
				expect(snapshot()).toMatchObject({
					controls: [{ name: "answer", value: "Use local files" }],
					storage: { draft: "Use local files" },
					text: "Direction",
				});
			},
		);
	}
}

for (const completion of [Exit.void, Exit.fail("the session failed")]) {
	screenScopeStory.it(
		`restores the browser transport when the session scope closes with ${completion._tag}`,
		[],
		function* ({ openSession, close, readTransport }) {
			const original = readTransport();
			yield* openSession();
			expect(readTransport()).not.toBe(original);
			yield* close(completion);
			expect(readTransport()).toBe(original);
		},
	);
}

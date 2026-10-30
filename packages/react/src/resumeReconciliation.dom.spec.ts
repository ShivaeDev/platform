import { expect } from "vitest";
import { liveResumeScreen, resumes } from "#test/resumeStories.ts";

for (const source of ["native", "browser"] as const) {
	resumes.it(`session live queries reconcile on ${source} resume and reconnect after interruption`, [liveResumeScreen(source)], function* (test) {
		yield* test.observe("the initial notes render", () => {
			expect(test.text()).toBe("One / Two");
			expect(test.resume().root?.container.querySelector("output")?.getAttribute("data-live")).toBe("live");
		});
		yield* test.externalRename(1, "Changed while away");
		yield* test.externalRename(2, "Also changed while away");
		expect(test.text()).toBe("One / Two");
		if (source === "native") {
			yield* test.nativeEvent();
		} else {
			yield* test.visibilityEvent();
		}
		yield* test.observe("resume reconciles every mounted query", () => expect(test.text()).toBe("Changed while away / Also changed while away"));
		yield* test.observe("resume retains the mounted subscriptions", () => expect(test.subscriptionStates()).toEqual(["open", "open"]));
		expect(test.resume().native.listeners.size).toBe(source === "native" ? 1 : 0);
		yield* test.disconnect();
		yield* test.observe("the interrupted stream closes", () => expect(test.active()).toBe(0));
		yield* test.externalRename(1, "Changed while disconnected");
		if (source === "native") {
			yield* test.nativeEvent();
		} else {
			yield* test.windowEvent();
		}
		yield* test.observe("the reconnected stream reconciles missed changes", () => {
			expect(test.subscriptionStates()).toEqual(["closed", "closed", "open", "open"]);
			expect(test.text()).toBe("Changed while disconnected / Also changed while away");
		});
		yield* test.close();
		expect(test.resume().native.listeners.size).toBe(0);
		yield* test.observe("registry disposal releases the stream", () => expect(test.active()).toBe(0));
	});
}

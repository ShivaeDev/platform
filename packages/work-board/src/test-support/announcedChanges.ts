import { Deferred, Effect, PubSub } from "effect";
import { vi } from "vitest";
import { boardStory } from "./boardStory.ts";
import { liveState } from "./liveState.ts";

export const announcedChanges = boardStory.trait("project", "the reader can see each file change the server announces", function* (engine) {
	const state = liveState(engine);
	const publish = PubSub.publish;
	const spy = vi.spyOn(PubSub, "publish").mockImplementation((...args: Parameters<typeof publish>) => {
		const event = args[1];
		if (
			typeof event === "object"
			&& event !== null
			&& "_tag" in event
			&& event._tag === "Changed"
			&& "paths" in event
			&& Array.isArray(event.paths)
		) {
			for (const path of event.paths) {
				const waiting = typeof path === "string" ? state.announced.get(path) : undefined;
				if (waiting) {
					Deferred.doneUnsafe(waiting, Effect.void);
				}
			}
		}
		return publish(...args);
	});
	yield* Effect.addFinalizer(() => Effect.sync(() => spy.mockRestore()));
});

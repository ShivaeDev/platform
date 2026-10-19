import { Effect, PubSub } from "effect";
import { vi } from "vitest";
import { boardStory } from "./boardStory.ts";

export const announcedChanges = boardStory.trait("project", "the reader can see each file change the server announces", function* (engine) {
	const announced: string[][] = [];
	engine.announcedChanges = announced;
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
			announced.push(event.paths.filter((path) => typeof path === "string"));
		}
		return publish(...args);
	});
	yield* Effect.addFinalizer(() => Effect.sync(() => spy.mockRestore()));
});

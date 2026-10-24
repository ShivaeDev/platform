import { availabilityActions } from "./screenAvailability.tsx";
import { screenData } from "./screenData.ts";
import { createScreen, screenView } from "./screenEngine.ts";
import { screenInteractions } from "./screenInteractions.ts";
import { screenObservations } from "./screenObservations.ts";
import { screenReadVerbs } from "./screenReads.ts";

export function pageRetryOptions() {
	return {
		clock: "live" as const,
		create: createScreen,
		inspect: screenView,
		name: "Board page retries",
		stages: ["workspace", "screen"] as const,
		verbs: (engine: Parameters<typeof screenView>[0], story: { readonly tell: (line: string) => void }) => ({
			...availabilityActions(engine, story.tell),
			...screenData(engine, story.tell),
			...screenInteractions(engine, story.tell),
			...screenObservations(engine, story.tell),
			...screenReadVerbs(engine, story.tell),
		}),
	};
}

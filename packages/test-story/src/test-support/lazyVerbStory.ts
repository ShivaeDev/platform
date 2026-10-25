import { storyKit } from "#storyKit.ts";

export const lazyVerbStory = storyKit({
	create: (): { count: number; observedCounts: number[]; reads: number } => ({ count: 0, observedCounts: [], reads: 0 }),
	name: "lazy verbs",
	stages: ["engine"],
	verbs: (engine) => ({
		get count() {
			engine.reads += 1;
			engine.observedCounts.push(engine.count);
			return engine.count;
		},
		getterReads: () => engine.reads,
		observedCounts: () => engine.observedCounts,
		setCount: (value: number) => {
			engine.count = value;
		},
		get unavailable() {
			throw new Error("This engine has no optional reader");
		},
	}),
});

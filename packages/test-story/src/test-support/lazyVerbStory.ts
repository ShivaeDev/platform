import { storyKit } from "#storyKit.ts";

export const lazyVerbStory = storyKit({
	create: (): { count: number; reads: number } => ({ count: 0, reads: 0 }),
	name: "lazy verbs",
	stages: ["engine"],
	verbs: (engine) => ({
		get count() {
			engine.reads += 1;
			return engine.count;
		},
		getterReads: () => engine.reads,
		setCount: (value: number) => {
			engine.count = value;
		},
		get unavailable() {
			throw new Error("This engine has no optional reader");
		},
	}),
});

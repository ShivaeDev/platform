import { storyKit } from "#storyKit.ts";

const first = storyKit({
	create: () => ({ first: 1 }),
	name: "first",
	stages: [],
	verbs: () => ({ read: () => undefined }),
});

const second = storyKit({
	create: () => ({ second: 1 }),
	name: "second",
	stages: [],
	verbs: () => ({ read: () => undefined }),
});

storyKit({ extends: [first, second], name: "duplicate verbs" });

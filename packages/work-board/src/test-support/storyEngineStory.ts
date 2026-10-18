import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { connected, createBoard, inspectBoard, openReader, serveProject } from "./storyEngine.ts";

export const storyEngineStory = storyKit({
	clock: "live",
	create: () => undefined,
	name: "board lifecycle",
	stages: [],
	verbs: () => ({ connected, createBoard, inspectBoard, openReader, serveProject }),
});

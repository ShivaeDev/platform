import { indentStory } from "#internal/indentStory.ts";
import type { StoryLog } from "#storyLog.ts";

const RECENT_LINES = 10;

export function unsettled(diagnosis: string, log: StoryLog): Error {
	return new Error(`${diagnosis}\nlast lines of the story:\n${indentStory(log.lines.slice(-RECENT_LINES))}`);
}

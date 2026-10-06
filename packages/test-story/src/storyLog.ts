import { onTestFailed } from "vitest";
import { indentStory } from "#internal/indentStory.ts";

export interface StoryLog {
	readonly lines: readonly string[];
	readonly tell: (line: string) => void;
}

export interface StoryLogOptions {
	readonly storyOnFailure?: boolean;
}

export function storyLog(options?: StoryLogOptions): StoryLog {
	const lines: string[] = [];
	if (options?.storyOnFailure !== false) {
		onTestFailed(({ task }) => {
			const failure = task.result?.errors?.[0];
			if (failure !== undefined) {
				failure.message = `${failure.message}\n\nThe story so far:\n${indentStory(lines)}`;
			}
		});
	}
	return {
		lines,
		tell: (line) => {
			lines.push(line);
		},
	};
}

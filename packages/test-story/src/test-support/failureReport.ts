import { relative } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const STORIES = relative(process.cwd(), fileURLToPath(new URL("./failingStories.ts", import.meta.url)));

export const LARGE_BAKERY =
	"node_modules/.cache/test-story/failingstories.ts--bakery-story-writes-a-bakery-too-large-to-print-to-a-file--bakery.json";

export function guide(name: string): string[] {
	return [
		"╭─ test-story: how to read the story below",
		'│ "given" lines are the test\'s traits, the other lines were told by verbs and engine steps as they ran, and ✗ marks',
		`│ where the test stopped. The traits, verbs and steps live in the ${name} story kit that this test imports.`,
		"╰─",
		"",
	];
}

export function failed(...lines: string[]) {
	return { errors: [lines.join("\n")], state: "failed" };
}

export function rerun(test: string): string {
	const command = `Rerun: vitest run ${STORIES} -t "${test}"`;
	return command.length > 120 ? `Rerun: vitest run ${STORIES} \\\n  -t "${test}"` : command;
}

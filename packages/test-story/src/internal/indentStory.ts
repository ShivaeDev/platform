export function indentStory(lines: readonly string[]): string {
	return lines.map((line) => `  ${line}`).join("\n");
}

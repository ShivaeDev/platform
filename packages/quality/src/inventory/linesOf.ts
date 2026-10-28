export function linesOf(text: string): readonly string[] {
	const lines = text.split("\n");
	return lines.at(-1) === "" ? lines.slice(0, -1) : lines;
}

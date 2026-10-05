export function workspaceFixture(): Readonly<Record<string, string>> {
	const cards = Array.from({ length: 100 }, (_, index) => `### Item ${index + 1}\n\nReview the evidence in [notes](notes/topic-1.md).\n`);
	const sections = ["To do", "In progress", "In review", "Done"].map(
		(title, index) => `## ${title}\n\n${cards.slice(index * 25, (index + 1) * 25).join("\n")}`,
	);
	const documents = Object.fromEntries(
		Array.from({ length: 48 }, (_, index) => [
			`notes/topic-${index + 1}.md`,
			`# Topic ${index + 1}\n\nA project note.\n\n## Evidence\n\n[Missing reference](missing.md)\n\n## Evidence\n\nA duplicate heading.\n\n${"Long prose with room to read. ".repeat(80)}`,
		]),
	);
	return {
		...documents,
		"board.md": `# Local collaboration\n\nA representative project with 100 items and 50 documents.\n\n${sections.join("\n")}`,
		"notes/flow & details.md":
			'# Flow and details\n\n```mermaid\ngraph TD; Agent-->Evidence; Evidence-->Review\n```\n\n<details>\n<summary>Review notes</summary>\n\nKeep this open during updates.\n\n</details>\n\n```json\n{"status": broken metadata}\n```',
	};
}

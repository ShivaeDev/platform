export function documentWorkspace(count = 1600): Readonly<Record<string, string>> {
	return Object.fromEntries(
		Array.from({ length: count }, (_document, index) => {
			const sections = Array.from(
				{ length: 8 },
				(_section, section) =>
					`## Section ${section}\n\nRead [related document](document-${(index + section + 1) % count}.md). ${"Ordinary project context and evidence. ".repeat(6 + (index % 11) * 6)}\n\n`,
			);
			const code = index % 5 === 0 ? "```ts\nconst result = 42;\nconsole.log(result);\n```\n" : "";
			return [
				`document-${index}.md`,
				`---\nid: fixture.${index}\nkind: task\nstatus: draft\ncriteria:\n - id: done\n   text: Verify this document\nrelationships:\n - kind: depends_on\n   target: fixture.${(index + 1) % count}#done\n---\n# Document ${index}\n\n${sections.join("")}${code}`,
			];
		}),
	);
}

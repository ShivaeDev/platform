import { requireThat } from "#error.ts";

export const sections = ["Added", "Changed", "Fixed", "Breaking"] as const;
export type Section = (typeof sections)[number];
export interface Entry {
	readonly section: Section;
	readonly text: string;
}

export function parseBody(name: string, body: string): readonly Entry[] {
	const entries: Entry[] = [];
	let section: Section | undefined;
	for (const line of body.split("\n")) {
		if (line.startsWith("### ")) {
			section = sections.find((value) => line === `### ${value}`);
			requireThat(section !== undefined, `${name}: use ### Added, ### Changed, ### Fixed or ### Breaking.`);
		} else if (line.startsWith("- ") && section !== undefined) {
			requireThat(line.slice(2).trim() !== "", `${name}: write text after '- '.`);
			entries.push({ section, text: line });
		} else if (line.trim() !== "") {
			const previous = entries.at(-1);
			if (previous === undefined || previous.section !== section || !/^\s+\S/u.test(line)) {
				requireThat(false, `${name}: start each entry with '- ' under a ### section heading.`);
			} else {
				entries[entries.length - 1] = { ...previous, text: `${previous.text}\n${line}` };
			}
		}
	}
	requireThat(entries.length > 0, `${name}: add at least one release-note entry under a ### section heading.`);
	return entries;
}

export function renderEntries(entries: readonly Entry[]): string {
	return sections
		.flatMap((section) => {
			const selected = entries.filter((entry) => entry.section === section);
			return selected.length === 0 ? [] : [`### ${section}\n\n${selected.map((entry) => entry.text).join("\n")}\n`];
		})
		.join("\n");
}

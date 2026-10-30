import { Effect } from "effect";
import { ChangesetError } from "#error.ts";

export const sections = ["Added", "Changed", "Fixed", "Breaking"] as const;
export type Section = (typeof sections)[number];
export interface Entry {
	readonly section: Section;
	readonly text: string;
}

export const parseBody = Effect.fn("Changesets.parseBody")(function* (name: string, body: string) {
	const entries: Entry[] = [];
	let section: Section | undefined;
	for (const line of body.split("\n")) {
		if (line.startsWith("### ")) {
			section = sections.find((value) => line === `### ${value}`);
			if (section === undefined) {
				return yield* new ChangesetError({ message: `${name}: use ### Added, ### Changed, ### Fixed or ### Breaking.` });
			}
		} else if (line.trim() !== "") {
			yield* appendEntry(name, line, section, entries);
		}
	}
	if (entries.length === 0) {
		return yield* new ChangesetError({ message: `${name}: add at least one release-note entry under a ### section heading.` });
	}
	return entries;
});

const appendEntry = Effect.fn("Changesets.appendEntry")(function* (name: string, line: string, section: Section | undefined, entries: Entry[]) {
	if (line.startsWith("- ") && section !== undefined) {
		if (line.slice(2).trim() === "") {
			return yield* new ChangesetError({ message: `${name}: write text after '- '.` });
		}
		entries.push({ section, text: line });
		return;
	}
	const previous = entries.at(-1);
	if (previous === undefined || previous.section !== section || !/^\s+\S/u.test(line)) {
		return yield* new ChangesetError({ message: `${name}: start each entry with '- ' under a ### section heading.` });
	}
	entries[entries.length - 1] = { ...previous, text: `${previous.text}\n${line}` };
});

export function renderEntries(entries: readonly Entry[]): string {
	return sections
		.flatMap((section) => {
			const selected = entries.filter((entry) => entry.section === section);
			return selected.length === 0 ? [] : [`### ${section}\n\n${selected.map((entry) => entry.text).join("\n")}\n`];
		})
		.join("\n");
}

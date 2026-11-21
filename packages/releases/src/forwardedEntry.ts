import type { Entry } from "#sections.ts";

export function forwardedEntry(owner: string, entry: Entry): Entry {
	return { section: entry.section, text: `- \`${owner}\`: ${entry.text.slice(2)}` };
}

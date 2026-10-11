export const sections = ["Added", "Changed", "Fixed", "Breaking"] as const;
export type Section = (typeof sections)[number];
export interface Fragment {
	readonly name: string;
	readonly text: string;
}
interface Entry {
	readonly section: Section;
	readonly text: string;
}

function appendEntry(name: string, entries: Entry[], section: Section, line: string): void {
	if (line.slice(2).trim() === "") {
		throw new Error(`${name}: an entry must have text.`);
	}
	entries.push({ section, text: line });
}

function appendContinuation(name: string, entries: Entry[], section: Section | undefined, line: string): void {
	const previous = entries.at(-1);
	if (previous === undefined || previous.section !== section || !/^\s+\S/u.test(line)) {
		throw new Error(`${name}: start each entry with '- ' under a '### <section>' heading.`);
	}
	entries[entries.length - 1] = { ...previous, text: `${previous.text}\n${line}` };
}

export function parseFragment({ name, text }: Fragment): readonly Entry[] {
	const entries: Entry[] = [];
	let section: Section | undefined;
	for (const line of text.trim().split("\n")) {
		if (line.startsWith("### ")) {
			section = sections.find((value) => line === `### ${value}`);
			if (section === undefined) {
				throw new Error(`${name}: use Added, Changed, Fixed or Breaking as the section.`);
			}
		} else if (line.startsWith("- ") && section !== undefined) {
			appendEntry(name, entries, section, line);
		} else if (line.trim() !== "") {
			appendContinuation(name, entries, section, line);
		}
	}
	if (entries.length === 0) {
		throw new Error(`${name}: a fragment must contain an entry.`);
	}
	return entries;
}

export function renderFragments(fragments: readonly Fragment[]): string {
	const entries = [...fragments].sort((left, right) => left.name.localeCompare(right.name)).flatMap(parseFragment);
	return sections
		.flatMap((section) => {
			const selected = entries.filter((entry) => entry.section === section);
			return selected.length === 0 ? [] : [`### ${section}\n\n${selected.map((entry) => entry.text).join("\n")}\n`];
		})
		.join("\n");
}

export function collectFragments(changelog: string, version: string, date: string, fragments: readonly Fragment[]): string {
	if (fragments.length === 0) {
		return changelog;
	}
	if (!(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/u.test(version) && /^\d{4}-\d{2}-\d{2}$/u.test(date))) {
		throw new Error("Use a package version and a YYYY-MM-DD release date.");
	}
	if (!changelog.startsWith("# Changelog\n") || /^## Unreleased\s*$/mu.test(changelog)) {
		throw new Error("Use a '# Changelog' title and move Unreleased entries into fragments first.");
	}
	if (changelog.split("\n").some((line) => line === `## ${version}` || line.startsWith(`## ${version} - `))) {
		throw new Error(`Version ${version} already has release notes; bump the package version before collecting fragments.`);
	}
	return `# Changelog\n\n## ${version} - ${date}\n\n${renderFragments(fragments)}${changelog.slice("# Changelog\n".length).trim() === "" ? "" : `\n${changelog.slice("# Changelog\n".length).trimStart()}`}`;
}

export function migrateUnreleased(changelog: string): { readonly changelog: string; readonly fragment: string } | undefined {
	const match = /^## Unreleased\s*\n(?<body>[\s\S]*?)(?=^## |$(?![\s\S]))/mu.exec(changelog);
	if (match === null || match.index === undefined) {
		return undefined;
	}
	const body = (match.groups?.body ?? "").trim();
	const released = changelog.slice(0, match.index) + changelog.slice(match.index + match[0].length);
	return {
		changelog: released.trim() === "# Changelog" ? "# Changelog\n" : released,
		fragment: body === "" ? "" : `${body.startsWith("### ") ? body : `### Added\n\n${body}`}\n`,
	};
}

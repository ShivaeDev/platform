export interface SourceLink {
	readonly href: string;
	readonly kind: string;
	readonly label: string;
	readonly status?: string | undefined;
	readonly title?: string | undefined;
}

const specificity = [
	"recorded response",
	"superseding response",
	"reviewed question",
	"agent handoff",
	"Criterion evidence",
	"Evidence source",
	"Attention request",
	"Implements",
	"Depends on",
	"Informs",
	"Board membership",
	"Related to",
	"Markdown link",
];
const kinds = new Map([
	["relates_to", "Related to"],
	["depends_on", "Depends on"],
	["implements", "Implements"],
	["informs", "Informs"],
]);
function priority(kind: string) {
	const index = specificity.indexOf(kinds.get(kind) ?? kind);
	return index < 0 ? specificity.length : index;
}

export function specificSources<T extends SourceLink>(links: readonly T[]): readonly T[] {
	const sources = new Map<string, T>();
	for (const link of links) {
		const previous = sources.get(link.href);
		if (!previous || priority(link.kind) < priority(previous.kind)) {
			sources.set(link.href, link);
		}
	}
	return [...sources.values()];
}

export function sourceGroups<T extends SourceLink>(links: readonly T[]) {
	return [...Map.groupBy(links, (link) => link.title ?? link.label)].map(([title, sources]) => ({
		label: `${title.startsWith("Fleet decision for ") ? "Fleet decisions" : title} (${sources.length})`,
		sources,
		title,
	}));
}

import type { Metadata } from "#metadata/schema.ts";

export interface SourceLink {
	readonly href: string;
	readonly kind: string;
	readonly label: string;
	readonly status?: string | undefined;
	readonly title?: string | undefined;
}

const outgoing: Readonly<Record<NonNullable<Metadata["relationships"]>[number]["kind"], string>> = {
	"depends_on": "Depends on",
	implements: "Implements",
	informs: "Informs",
	"relates_to": "Related to",
};
const incoming = new Map([
	["agent handoff", "Agent handoff"],
	["attention target", "Attention request"],
	["board member", "Listed on board"],
	["criterion evidence", "Criterion evidence"],
	["depends_on", "Needed by"],
	["evidence source", "Cited as evidence by"],
	["implements", "Implemented by"],
	["informs", "Informed by"],
	["recorded response", "Recorded response"],
	["relates_to", "Related to"],
	["reviewed question", "Reviewed question"],
	["superseding response", "Superseding response"],
]);
const specificity = [
	"Recorded response",
	"Superseding response",
	"Reviewed question",
	"Agent handoff",
	"Criterion evidence",
	"Cited as evidence by",
	"Attention request",
	"Implements",
	"Implemented by",
	"Depends on",
	"Needed by",
	"Informs",
	"Informed by",
	"Listed on board",
	"Related to",
	"Markdown link",
];

export function linkLabel(kind: keyof typeof outgoing): string {
	return outgoing[kind];
}

export function backlinkLabel(kind: string): string {
	return incoming.get(kind) ?? kind;
}

function priority(kind: string) {
	const index = specificity.indexOf(kind);
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

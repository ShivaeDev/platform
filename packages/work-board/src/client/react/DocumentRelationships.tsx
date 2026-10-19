import type { Document } from "#browser/document/schema.ts";
import { linkLabel, specificSources } from "#browser/document/sourceGroups.ts";
import { keyed } from "./keyed.ts";
import { Reference } from "./Reference.tsx";
import { SourceSection } from "./SourceSection.tsx";

const BOARD_ITEMS = "Board items";

export function DocumentRelationships({ document }: { readonly document: Document }) {
	const targets = [
		...(document.metadata.relationships ?? []).map((link) => ({ kind: linkLabel(link.kind), target: link.target })),
		...(document.metadata.items ?? []).map((target) => ({ kind: BOARD_ITEMS, target })),
	];
	if (targets.length === 0) {
		return null;
	}
	const resolved = targets
		.filter((link) => document.references[link.target])
		.map((link) => ({
			href: document.references[link.target] ?? "",
			kind: link.kind,
			label: link.target,
			status: document.referenceDetails?.[link.target]?.status,
			title: document.referenceDetails?.[link.target]?.title,
		}));
	const links = [...specificSources(resolved.filter((link) => link.kind !== BOARD_ITEMS)), ...resolved.filter((link) => link.kind === BOARD_ITEMS)];
	const missing = keyed(
		targets.filter((link) => !document.references[link.target]),
		(link) => `${link.kind}:${link.target}`,
	).map(({ key, value: link }) => (
		<li key={key}>
			{link.kind}: <Reference document={document} target={link.target} />
		</li>
	));
	return (
		<section aria-label="Links to">
			<h3>Links to</h3>
			{[...Map.groupBy(links, (link) => link.kind)].map(([kind, sources]) => (
				<SourceSection key={kind} label={kind} links={sources} />
			))}
			{missing.length > 0 && <ul>{missing}</ul>}
		</section>
	);
}

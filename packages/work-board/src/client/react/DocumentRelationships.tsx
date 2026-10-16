import type { Document } from "#browser/document/schema.ts";
import { type SourceLink, specificSources } from "#browser/document/sourceGroups.ts";
import { keyed } from "./keyed.ts";
import { Reference } from "./Reference.tsx";
import { SourceList } from "./SourceList.tsx";
export function DocumentRelationships({ document }: { readonly document: Document }) {
	const fields = document.metadata;
	const relationships = fields.relationships ?? [];
	const links = specificSources(
		relationships
			.map((link) => ({
				href: document.references[link.target] ?? "",
				kind: link.kind,
				label: link.target,
				status: document.referenceDetails?.[link.target]?.status,
				title: document.referenceDetails?.[link.target]?.title,
			}))
			.filter((link) => link.href),
	);
	const unresolved = relationships.filter((link) => !document.references[link.target]);
	const missing = keyed(unresolved, (link) => `${link.kind}:${link.target}`).map(({ key, value: link }) => (
		<li key={key}>
			{link.kind.replaceAll("_", " ")}: <Reference document={document} target={link.target} />
		</li>
	));
	const items = keyed(fields.items ?? [], (id) => id).map(({ key, value: id }) => (
		<li key={key}>
			<Reference document={document} target={id} />
		</li>
	));
	return (
		<>
			{links.length + unresolved.length > 0 && (
				<section aria-label="Relationships">
					<h3>Relationships</h3>
					{[...Map.groupBy(links, (link) => link.kind)].map(([kind, sources]) => (
						<RelationshipGroup key={kind} kind={kind} sources={sources} />
					))}
					{missing.length > 0 && <ul>{missing}</ul>}
				</section>
			)}
			{items.length > 0 && (
				<section aria-label="Board membership">
					<h3>Declared board membership</h3>
					<ul>{items}</ul>
				</section>
			)}
		</>
	);
}

function RelationshipGroup({ kind, sources }: { readonly kind: string; readonly sources: readonly SourceLink[] }) {
	return (
		<div>
			<h4>{kind.replaceAll("_", " ")}</h4>
			<SourceList links={sources} />
		</div>
	);
}

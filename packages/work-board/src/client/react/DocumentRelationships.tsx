import type { Document } from "#browser/document/schema.ts";
import { keyed } from "./keyed.ts";
import { Reference } from "./Reference.tsx";
export function DocumentRelationships({ document }: { readonly document: Document }) {
	const fields = document.metadata;
	const relationships = fields.relationships ?? [];
	const links = keyed(relationships, (link) => `${link.kind}:${link.target}`).map(({ key, value: link }) => (
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
			{links.length > 0 && (
				<section aria-label="Relationships">
					<h3>Relationships</h3>
					<ul>{links}</ul>
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

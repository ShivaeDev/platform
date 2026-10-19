import type { Document } from "#browser/document/schema.ts";
import { Separator } from "#client/react/components/ui/separator.tsx";
import { DocumentRelationships } from "./DocumentRelationships.tsx";
import { DocumentWorkMetadata } from "./DocumentWorkMetadata.tsx";
import { metadataParts } from "./metadataParts.ts";
import { SourceSection } from "./SourceSection.tsx";

export function DocumentMetadata({ document }: { readonly document: Document }) {
	const { backlinks, linksTo, work } = metadataParts(document);
	return (
		<>
			{work ? <DocumentWorkMetadata document={document} /> : null}
			<DocumentRelationships document={document} />
			{linksTo && (backlinks.length > 0 || document.unavailable.length > 0) && <Separator className="my-4" />}
			{document.unavailable.length > 0 && (
				<p role="status">
					Available source references only; unreadable files prevent complete backlink and identity validation: {document.unavailable.join(", ")}
				</p>
			)}
			{backlinks.length > 0 && (
				<div className="work-context" data-context-group="linked-from">
					<h3 title="These are explicit source links, not inferred blockers or workflow rules.">Linked from</h3>
					{[...Map.groupBy(backlinks, (link) => link.kind)].map(([kind, links]) => (
						<SourceSection group={kind} key={kind} label={`${kind} (${links.length})`} links={links} />
					))}
				</div>
			)}
		</>
	);
}

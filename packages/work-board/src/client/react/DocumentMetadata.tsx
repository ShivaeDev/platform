import type { Document } from "#browser/document/schema.ts";
import { specificSources } from "#browser/document/sourceGroups.ts";
import { Separator } from "#client/react/components/ui/separator.tsx";
import { DocumentRelationships } from "./DocumentRelationships.tsx";
import { DocumentWorkMetadata } from "./DocumentWorkMetadata.tsx";
import { SourceSection } from "./SourceSection.tsx";

export function DocumentMetadata({ document }: { readonly document: Document }) {
	const reading = document.reading;
	const backlinks = specificSources(reading?.backlinks ?? []).filter(
		(link) => document.metadata.kind !== "project" || link.kind !== "Implemented by",
	);
	const linksTo = (document.metadata.relationships?.length ?? 0) + (document.metadata.items?.length ?? 0) > 0;
	return (
		<>
			{(reading?.raw !== undefined || document.diagnostics.length > 0) && <DocumentWorkMetadata document={document} />}
			<DocumentRelationships document={document} />
			{linksTo && (backlinks.length > 0 || document.unavailable.length > 0) && <Separator className="my-4" />}
			{document.unavailable.length > 0 && (
				<p role="status">
					Available source references only; unreadable files prevent complete backlink and identity validation: {document.unavailable.join(", ")}
				</p>
			)}
			{backlinks.length > 0 && (
				<section aria-label="Linked from" className="work-context">
					<h3 title="These are explicit source links, not inferred blockers or workflow rules.">Linked from</h3>
					{[...Map.groupBy(backlinks, (link) => link.kind)].map(([kind, links]) => (
						<SourceSection key={kind} label={`${kind} (${links.length})`} links={links} name={`${kind} backlinks`} />
					))}
				</section>
			)}
		</>
	);
}

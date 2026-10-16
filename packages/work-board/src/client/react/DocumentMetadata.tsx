import type { Document } from "#browser/document/schema.ts";
import { specificSources } from "#browser/document/sourceGroups.ts";
import { DocumentWorkMetadata } from "./DocumentWorkMetadata.tsx";
import { SourceList } from "./SourceList.tsx";

export function DocumentMetadata({ document }: { readonly document: Document }) {
	const reading = document.reading;
	const backlinks = specificSources(reading?.backlinks ?? []).filter((link) => document.metadata.kind !== "project" || link.kind !== "Implements");
	const groups = [...Map.groupBy(backlinks, (link) => link.kind)].map(([kind, links]) => (
		<section aria-label={`${kind} backlinks`} key={kind}>
			<h4>
				{kind} ({links.length})
			</h4>
			<SourceList links={links} />
		</section>
	));
	return (
		<>
			{(reading?.raw !== undefined || document.diagnostics.length > 0) && <DocumentWorkMetadata document={document} />}
			{document.unavailable.length > 0 && (
				<p role="status">
					Available source references only; unreadable files prevent complete backlink and identity validation: {document.unavailable.join(", ")}
				</p>
			)}
			{backlinks.length > 0 && (
				<section aria-label="Source backlinks" className="work-context">
					<h3 title="These are explicit source links, not inferred blockers or workflow rules.">Referenced by ({backlinks.length})</h3>
					{groups}
				</section>
			)}
		</>
	);
}

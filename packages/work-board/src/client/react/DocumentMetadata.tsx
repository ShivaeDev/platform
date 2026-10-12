import type { Document } from "#browser/document/schema.ts";
import { DocumentWorkMetadata } from "./DocumentWorkMetadata.tsx";
import { keyed } from "./keyed.ts";
export function DocumentMetadata({ document }: { readonly document: Document }) {
	const reading = document.reading;
	const backlinks = reading?.backlinks ?? [];
	const entries = keyed(backlinks, (link) => `${link.href}:${link.kind}:${link.label}`).map(({ key, value: link }) => (
		<li key={key}>
			{link.kind}: <a href={link.href}>{link.label}</a>
		</li>
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
					<details data-key="work-backlinks">
						<summary>Referenced by ({backlinks.length})</summary>
						<ul>{entries}</ul>
						<p>These are explicit source links, not inferred blockers or workflow rules.</p>
					</details>
				</section>
			)}
		</>
	);
}

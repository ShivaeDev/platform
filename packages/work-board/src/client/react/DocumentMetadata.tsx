import type { Document } from "#browser/document/schema.ts";
import { DocumentWorkMetadata } from "./DocumentWorkMetadata.tsx";
import { keyed } from "./keyed.ts";
export function DocumentMetadata({ document }: { readonly document: Document }) {
	const reading = document.reading;
	const backlinks = reading?.backlinks ?? [];
	const groups = [...new Set(backlinks.map((link) => link.kind))].map((kind) => (
		<section aria-label={`${kind} backlinks`} key={kind}>
			<h4>
				{kind} ({backlinks.filter((link) => link.kind === kind).length})
			</h4>
			<ul>
				{keyed(
					backlinks.filter((link) => link.kind === kind),
					(link) => `${link.href}:${link.label}`,
				).map(({ key, value: link }) => (
					<li key={key}>
						<a className="font-mono text-xs" href={link.href}>
							{link.label}
						</a>
					</li>
				))}
			</ul>
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
					<h3>Referenced by ({backlinks.length})</h3>
					{groups}
					<p>These are explicit source links, not inferred blockers or workflow rules.</p>
				</section>
			)}
		</>
	);
}

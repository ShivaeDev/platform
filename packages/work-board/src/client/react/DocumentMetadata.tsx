import type { ReadingContext } from "#browser/document/ReadingContext.ts";
import type { Document } from "#browser/document/schema.ts";
import { StatusChip } from "#client/react/components/ui/StatusChip.tsx";
import { DocumentWorkMetadata } from "./DocumentWorkMetadata.tsx";
import { keyed } from "./keyed.ts";
export function DocumentMetadata({ document }: { readonly document: Document }) {
	const reading = document.reading;
	const backlinks = (reading?.backlinks ?? []).filter((link) => document.metadata.kind !== "project" || link.kind !== "Implements");
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
					<Backlink key={key} link={link} />
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

function Backlink({ link }: { readonly link: ReadingContext["backlinks"][number] }) {
	return (
		<li>
			<span className="inline-flex flex-wrap items-center gap-2">
				<a href={link.href} title={link.label}>
					{link.title ?? link.label}
				</a>
				<StatusChip status={link.status} />
			</span>
		</li>
	);
}

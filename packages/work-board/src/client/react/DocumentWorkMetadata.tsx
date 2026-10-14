import type { Document } from "#browser/document/schema.ts";
import { DocumentEvidence } from "./DocumentEvidence.tsx";
import { DocumentRecords } from "./DocumentRecords.tsx";
import { DocumentRelationships } from "./DocumentRelationships.tsx";
import { keyed } from "./keyed.ts";
export function DocumentWorkMetadata({ document }: { readonly document: Document }) {
	return (
		<section aria-label="Work details" className="work-meta">
			<MetadataLead document={document} />
			<DocumentEvidence document={document} />
			<DocumentRelationships document={document} />
			<DocumentRecords document={document} />
		</section>
	);
}

function MetadataLead({ document }: { readonly document: Document }) {
	const diagnostics = keyed(document.diagnostics, (problem) => `${problem.line}:${problem.message}`).map(({ key, value: problem }) => (
		<li key={key}>
			<code>
				{document.file}:{problem.line}
			</code>{" "}
			— {problem.message}
		</li>
	));
	return (
		<>
			{diagnostics.length > 0 && (
				<div className="metadata-problems" role="status">
					<b>Source diagnostics</b>
					<ul>{diagnostics}</ul>
				</div>
			)}
		</>
	);
}

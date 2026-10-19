import type { Document } from "#browser/document/schema.ts";
import { fileUrl } from "#files/url.ts";
import { DocumentAttention } from "./DocumentAttention.tsx";
import { DocumentRecords } from "./DocumentRecords.tsx";
import { LinkButton } from "./LinkButton.tsx";
export function DocumentSource({ document }: { readonly document: Document }) {
	const reading = document.reading;
	const hashed = /[a-f\d]{64}/iu.test(document.file);
	return (
		<div className="space-y-4" data-document-source="">
			<p>
				Source:{" "}
				{hashed ? (
					`line ${reading?.lines.id ?? 1}`
				) : (
					<code>
						{document.file}:{reading?.lines.id ?? 1}
					</code>
				)}
				; prose starts at line {reading?.proseLine ?? 1}.
			</p>
			{hashed && <LinkButton href={fileUrl(document.file)}>Open source file</LinkButton>}
			{reading?.raw !== undefined && (
				<>
					<h3>Original frontmatter</h3>
					<pre className="overflow-auto whitespace-pre-wrap font-mono text-xs">{reading.raw}</pre>
				</>
			)}
			<DocumentAttention document={document} />
			<DocumentRecords document={document} />
		</div>
	);
}

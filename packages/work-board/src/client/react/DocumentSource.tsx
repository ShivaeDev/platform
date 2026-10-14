import type { Document } from "#browser/document/schema.ts";
export function DocumentSource({ document }: { readonly document: Document }) {
	const reading = document.reading;
	return (
		<section aria-label="Document source" className="space-y-4">
			<p>
				Source:{" "}
				<code>
					{document.file}:{reading?.lines.id ?? 1}
				</code>
				; prose starts at line {reading?.proseLine ?? 1}.
			</p>
			{reading?.raw !== undefined && (
				<>
					<h3>Original frontmatter</h3>
					<pre className="overflow-auto whitespace-pre-wrap font-mono text-xs">{reading.raw}</pre>
				</>
			)}
		</section>
	);
}

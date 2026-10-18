export interface CodePreviewLine {
	readonly kind: "added" | "removed" | "context";
	readonly number: number;
	readonly text: string;
}

const styles = {
	added: "bg-code-added/10 text-code-added",
	context: "text-muted-foreground",
	removed: "bg-destructive/10 text-destructive",
};
const markers = { added: "+", context: " ", removed: "-" };

export function CodePreview({ label, lines }: { readonly label: string; readonly lines: readonly CodePreviewLine[] }) {
	return (
		<section aria-label={label}>
			<pre className="overflow-x-auto rounded-md border bg-muted/30 p-4 font-mono text-sm">
				<code>
					{lines.map((line) => (
						<span className={`block ${styles[line.kind]}`} data-line-kind={line.kind} key={line.number}>
							<span aria-hidden="true">{markers[line.kind]} </span>
							{`${line.text}\n`}
						</span>
					))}
				</code>
			</pre>
		</section>
	);
}

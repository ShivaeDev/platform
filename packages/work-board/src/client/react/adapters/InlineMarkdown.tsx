import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Document } from "#browser/document/schema.ts";
import { documentLinks } from "#render/documentLinks.ts";

const inline = ["a", "code", "del", "em", "strong"];

export function InlineMarkdown({ document, source }: { readonly document: Document; readonly source: string }) {
	return (
		<Markdown
			allowedElements={inline}
			rehypePlugins={[documentLinks(document.file, document.links)]}
			remarkPlugins={[remarkGfm]}
			skipHtml
			unwrapDisallowed
		>
			{source}
		</Markdown>
	);
}

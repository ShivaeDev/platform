import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { documentLinks } from "#render/documentLinks.ts";

export function ResponseMarkdown({ source, file }: { readonly source: string; readonly file: string }) {
	return (
		<Markdown rehypePlugins={[documentLinks(file, {})]} remarkPlugins={[remarkGfm]} skipHtml>
			{source}
		</Markdown>
	);
}

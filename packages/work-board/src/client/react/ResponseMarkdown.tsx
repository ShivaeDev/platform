import type { Components } from "react-markdown";
import Markdown from "react-markdown";
import { Mermaid } from "#client/document/Mermaid.ts";
import { documentLinks } from "#render/documentLinks.ts";
import { documentPlugins } from "#render/documentPlugins.ts";

export function ResponseMarkdown({ source, file }: { readonly source: string; readonly file: string }) {
	return (
		<Markdown components={components} rehypePlugins={[documentLinks(file, {})]} remarkPlugins={documentPlugins()} skipHtml>
			{source}
		</Markdown>
	);
}

const components: Components = {
	code: ({ node: _node, className, children, ...props }) => {
		if (!className?.split(" ").includes("language-mermaid")) {
			return (
				<code {...props} className={className}>
					{children}
				</code>
			);
		}
		const source = String(children);
		return typeof document === "undefined" ? (
			<figure className="diagram">
				<pre className="diagram-source">{source}</pre>
			</figure>
		) : (
			<Mermaid source={source} />
		);
	},
	pre: ({ node, children, ...props }) => {
		const code = node?.children[0];
		return code?.type === "element" && Array.isArray(code.properties.className) && code.properties.className.includes("language-mermaid") ? (
			children
		) : (
			<pre {...props}>{children}</pre>
		);
	},
};

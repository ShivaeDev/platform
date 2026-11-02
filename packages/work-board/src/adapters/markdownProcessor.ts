import type { Root } from "mdast";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { type PluggableList, unified } from "unified";

export function parseMarkdown(source: string, { directives = false, gfm = false } = {}): Root {
	const processor = unified().use(remarkParse);
	if (directives) {
		processor.use(remarkDirective);
	}
	if (gfm) {
		processor.use(remarkGfm);
	}
	return processor.parse(source);
}

export function transformMarkdown(source: string, plugins: PluggableList): Root {
	const processor = unified().use(remarkParse).use(plugins);
	const tree = processor.parse(source);
	processor.runSync(tree, { value: source });
	return tree;
}

import type { RootContent } from "mdast";
import { fileUrl } from "#files/url.ts";

function destination(url: string, file: string) {
	if (url.startsWith("//") || url.search(/^[a-z][a-z\d+.-]*:/iu) === 0) {
		return url;
	}
	const resolved = new URL(url, `http://work-board.local${fileUrl(file)}`);
	return resolved.pathname + resolved.search + resolved.hash;
}
function titleSuffix(title: string | null | undefined) {
	return title ? ` "${title.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"` : "";
}
export function templateLinks(source: string, nodes: readonly RootContent[], file: string) {
	const edits: { readonly start: number; readonly end: number; readonly text: string }[] = [];
	function visit(node: RootContent) {
		const start = node.position?.start.offset;
		const end = node.position?.end.offset;
		if (start === undefined || end === undefined) {
			return;
		}
		if (node.type === "link") {
			const label = source.slice(node.children.at(0)?.position?.start.offset, node.children.at(-1)?.position?.end.offset);
			edits.push({ end, start, text: `[${label}](<${destination(node.url, file)}>${titleSuffix(node.title)})` });
		} else if (node.type === "image") {
			edits.push({
				end,
				start,
				text: `![${(node.alt ?? "").replaceAll("[", "\\[").replaceAll("]", "\\]")}](<${destination(node.url, file)}>${titleSuffix(node.title)})`,
			});
		} else if (node.type === "definition") {
			edits.push({ end, start, text: `[${node.label ?? node.identifier}]: <${destination(node.url, file)}>${titleSuffix(node.title)}` });
		} else if ("children" in node) {
			node.children.forEach(visit);
		}
	}
	nodes.forEach(visit);
	let result = source;
	for (const edit of edits.sort((a, b) => b.start - a.start)) {
		result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
	}
	return result;
}

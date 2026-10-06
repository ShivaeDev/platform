import type { Root, RootContent } from "mdast";
import type { ContainerDirective, LeafDirective, TextDirective } from "mdast-util-directive";
import { SKIP, visit as visitNodes } from "unist-util-visit";
import { renderVisual } from "./visual.ts";

type Directive = ContainerDirective | LeafDirective | TextDirective;
const names = new Set(["metric", "progress", "timeline"]);

function isDirective(node: { readonly type: string }): node is Directive {
	return node.type === "containerDirective" || node.type === "leafDirective" || node.type === "textDirective";
}

function nested(node: RootContent): boolean {
	return isDirective(node) || ("children" in node && node.children.some((child) => nested(child)));
}

function failureOf(node: Directive, source: string): string | undefined {
	try {
		if (!names.has(node.name)) {
			throw new Error(`Unknown visual directive ${node.name}.`);
		}
		if (node.type !== "containerDirective") {
			throw new Error("Use a ::: container directive.");
		}
		const length = new TextEncoder().encode(source.slice(node.position?.start.offset, node.position?.end.offset)).byteLength;
		if (length > 65_536) {
			throw new Error("Visual directive exceeds 64 KiB.");
		}
		if (node.children.some((child) => nested(child))) {
			throw new Error("Nested visual directives are not supported.");
		}
		renderVisual(node);
		return undefined;
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}

export function visualDocuments() {
	return function transform(tree: Root, file: { readonly value: unknown }) {
		const source = String(file.value);
		visitNodes(tree, ["containerDirective", "leafDirective", "textDirective"], (directive, index, parent) => {
			if (!isDirective(directive) || index === undefined || parent === undefined) {
				return;
			}
			if (directive.type === "containerDirective" && ["question", "option"].includes(directive.name)) {
				return;
			}
			const failure = failureOf(directive, source);
			if (failure === undefined) {
				return;
			}
			const original = source.slice(directive.position?.start.offset, directive.position?.end.offset);
			if (directive.type === "textDirective") {
				parent.children.splice(index, 1, { type: "text", value: original });
				return [SKIP, index + 1] as const;
			}
			parent.children.splice(
				index,
				1,
				{
					children: [{ type: "text", value: `Visual component could not be rendered: ${failure}` }],
					data: { hProperties: { className: ["visual-diagnostic"] } },
					type: "paragraph",
				},
				{ type: "code", value: original },
			);
			return [SKIP, index + 2] as const;
		});
	};
}

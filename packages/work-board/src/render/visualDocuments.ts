import type { Root, RootContent } from "mdast";
import type { ContainerDirective, LeafDirective, TextDirective } from "mdast-util-directive";
import { SKIP, visit as visitNodes } from "unist-util-visit";
import { BadRequest } from "@shivaedev/contract/errors/taxonomy.ts";
import { errorMessage } from "#errorMessage.ts";
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
			throw new BadRequest({ message: `Unknown visual directive ${node.name}. Use metric, progress or timeline.` });
		}
		if (node.type !== "containerDirective") {
			throw new BadRequest({ message: "Use a ::: container directive." });
		}
		const length = new TextEncoder().encode(source.slice(node.position?.start.offset, node.position?.end.offset)).byteLength;
		if (length > 65_536) {
			throw new BadRequest({ message: "Visual directive exceeds 64 KiB. Split it into smaller components." });
		}
		if (node.children.some((child) => nested(child))) {
			throw new BadRequest({ message: "Nested visual directives are not supported. Move each component to the top level." });
		}
		renderVisual(node);
		return undefined;
	} catch (error) {
		return errorMessage(error);
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

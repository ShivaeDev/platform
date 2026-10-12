import { Schema } from "effect";
import type { RootContent } from "mdast";
import type { ContainerDirective } from "mdast-util-directive";
import type { Prompt } from "#browser/responses/Prompt.ts";
import { Identity } from "#path/Identity.ts";

const Id = Identity.check(Schema.isMaxLength(128));
const PromptFields = Schema.Struct({ id: Id, request: Schema.optional(Identity), select: Schema.optional(Schema.Literals(["one", "many", "text"])) });
const OptionFields = Schema.Struct({ id: Id });

export function sliceNode(source: string, node: RootContent) {
	return source.slice(node.position?.start.offset, node.position?.end.offset);
}
export function isContainer(node: RootContent): node is ContainerDirective {
	return node.type === "containerDirective";
}
function hasControl(node: RootContent): boolean {
	return (
		((node.type === "containerDirective" || node.type === "leafDirective" || node.type === "textDirective")
			&& ["question", "option"].includes(node.name))
		|| ("children" in node && node.children.some(hasControl))
	);
}
export function promptFrom(node: ContainerDirective, source: string) {
	const attrs = Schema.decodeUnknownSync(PromptFields, { onExcessProperty: "error" })(node.attributes ?? {});
	const options = node.children.filter((child) => isContainer(child) && child.name === "option");
	const description = node.children.filter((child) => !(isContainer(child) && child.name === "option"));
	if (
		description.some(hasControl)
		|| description.length === 0
		|| options.length > 32
		|| (attrs.select === "text" ? options.length > 0 : options.length === 0)
	) {
		throw new Error("A question needs Markdown context and 1–32 direct options (or select=text without options), without nested questions.");
	}
	const choices = options.map((option) => {
		if (!isContainer(option) || option.children.some(hasControl) || option.children.length === 0) {
			throw new Error("Options need Markdown descriptions and cannot nest response controls.");
		}
		const fields = Schema.decodeUnknownSync(OptionFields, { onExcessProperty: "error" })(option.attributes ?? {});
		return { id: fields.id, source: option.children.map((child) => sliceNode(source, child)).join("\n\n") };
	});
	if (new Set(choices.map((option) => option.id)).size !== choices.length) {
		throw new Error("Option IDs must be unique within each question.");
	}
	return {
		prompt: {
			id: attrs.id,
			mode: attrs.select ?? "one",
			options: choices,
			source: description.map((child) => sliceNode(source, child)).join("\n\n"),
		} satisfies Prompt,
		request: attrs.request,
	};
}

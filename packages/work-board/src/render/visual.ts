import { Option, Schema } from "effect";
import type { Paragraph, RootContent } from "mdast";
import type { ContainerDirective } from "mdast-util-directive";
import { MetricFields, ProgressFields } from "./visualFields.ts";

function textOf(node: RootContent): string {
	if ("value" in node) {
		return node.value;
	}
	return "children" in node ? node.children.map((child) => textOf(child)).join("") : "";
}

function paragraph(value: string, className?: string): Paragraph {
	return { children: [{ type: "text", value }], data: { hProperties: { className: className ? [className] : [] } }, type: "paragraph" };
}

function hasLink(node: RootContent): boolean {
	if (node.type === "link") {
		return node.url.trim().length > 0;
	}
	if (node.type === "linkReference") {
		return node.identifier.trim().length > 0;
	}
	return "children" in node && node.children.some((child) => hasLink(child));
}

function provenance(node: ContainerDirective): boolean {
	return node.children.some((child) => child.type === "paragraph" && textOf(child).toLowerCase().startsWith("source:") && hasLink(child));
}

function fields<A>(schema: Schema.ConstraintDecoder<A, never>, node: ContainerDirective): A {
	const parsed = Schema.decodeUnknownOption(schema, { onExcessProperty: "error" })(node.attributes ?? {});
	if (Option.isNone(parsed)) {
		throw new Error("Invalid or unknown attributes.");
	}
	return parsed.value;
}

function metric(node: ContainerDirective) {
	const { unit, value } = fields(MetricFields, node);
	if (!provenance(node)) {
		throw new Error("Name a source with a Source: Markdown link.");
	}
	node.children.splice(1, 0, paragraph(value === undefined || value === "unknown" ? "Not recorded" : `${value} ${unit}`, "visual-value"));
}

function progress(node: ContainerDirective, label: string) {
	const { completed, total } = fields(ProgressFields, node);
	if (!provenance(node)) {
		throw new Error("Name a source with a Source: Markdown link.");
	}
	const known = typeof completed === "number" && typeof total === "number";
	if (known && completed > total) {
		throw new Error("Completed count exceeds total.");
	}
	function display(value: number | "unknown" | undefined) {
		return typeof value === "number" ? String(value) : "Not recorded";
	}
	const tally = `Recorded tally: ${display(completed)} of ${display(total)}`;
	node.children.splice(1, 0, paragraph(tally + (known && total > 0 ? "" : ". Percentage unavailable."), "visual-value"));
	if (known && total > 0) {
		node.children.splice(2, 0, {
			children: [{ type: "text", value: tally }],
			data: { hName: "progress", hProperties: { ariaLabel: `${label}: ${tally}`, max: String(total), value: String(completed) } },
			type: "paragraph",
		});
	}
}

function timeline(node: ContainerDirective) {
	fields(Schema.Struct({}), node);
	const lists = node.children.filter((child) => child.type === "list");
	const [list] = lists;
	if (lists.length !== 1 || !list?.ordered || list.children.length === 0 || list.children.length > 100) {
		throw new Error("Use one ordered list with 1–100 entries.");
	}
	if (list.children.some((item) => !hasLink(item) || textOf(item).trim().length === 0)) {
		throw new Error("Each timeline entry needs text and a source link.");
	}
	list.data = { ...list.data, hProperties: { className: ["visual-timeline-entries"] } };
}

export function renderVisual(node: ContainerDirective) {
	const [first] = node.children;
	if (first?.type !== "paragraph" || textOf(first).trim().length === 0 || textOf(first).toLowerCase().startsWith("source:")) {
		throw new Error("Start with a Markdown label paragraph.");
	}
	const label = textOf(first).trim();
	if (node.name === "metric") {
		metric(node);
	}
	if (node.name === "progress") {
		progress(node, label);
	}
	if (node.name === "timeline") {
		timeline(node);
	}
	first.data = { ...first.data, hProperties: { className: ["visual-label"] } };
	node.data = { ...node.data, hName: "section", hProperties: { ariaLabel: label, className: ["visual-document", `visual-${node.name}`] } };
}

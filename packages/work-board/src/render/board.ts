import type { RootContent } from "mdast";
import { markdownToMdast } from "satteri";

export interface Section {
	readonly heading: string;
	readonly items: readonly string[];
	readonly notes: string;
	readonly title: string;
}

export interface Board {
	readonly definitions: string;
	readonly footer: string;
	readonly intro: string;
	readonly sections: readonly Section[];
	readonly title: string;
}

interface Draft {
	definitions: string[];
	footer: string[] | undefined;
	intro: string[];
	sections: Array<{ title: string; heading: string; notes: string[]; items: string[][] }>;
	title: string;
}

const textOf = (node: RootContent): string => {
	if ("value" in node) {
		return node.value;
	}
	return "children" in node ? node.children.map((child) => textOf(child)).join("") : "";
};

const isSection = (node: RootContent): boolean => node.type === "heading" && node.depth === 2;

const place = (draft: Draft, node: RootContent, source: string, closing: boolean): void => {
	const section = draft.sections.at(-1);
	if (node.type === "definition" || node.type === "footnoteDefinition") {
		draft.definitions.push(source);
	} else if (draft.footer !== undefined) {
		draft.footer.push(source);
	} else if (node.type === "heading" && node.depth === 1 && draft.title === "") {
		draft.title = source;
	} else if (isSection(node)) {
		draft.sections.push({ heading: source, items: [], notes: [], title: textOf(node) });
	} else if (section === undefined) {
		draft.intro.push(source);
	} else if (node.type === "heading" && node.depth === 3) {
		section.items.push([source]);
	} else if (node.type === "thematicBreak" && closing) {
		draft.footer = [];
	} else {
		(section.items.at(-1) ?? section.notes).push(source);
	}
};

const joined = (blocks: readonly string[]): string => blocks.join("\n\n");

export const boardOf = (source: string): Board => {
	const draft: Draft = { definitions: [], footer: undefined, intro: [], sections: [], title: "" };
	const root = markdownToMdast(source);
	const nodes = root.type === "root" ? root.children : [];
	const lastHeading = nodes.findLastIndex((node) => node.type === "heading");
	nodes.forEach((node, index) => {
		place(draft, node, source.slice(node.position?.start.offset, node.position?.end.offset), index > lastHeading);
	});
	return {
		definitions: joined(draft.definitions),
		footer: joined(draft.footer ?? []),
		intro: joined(draft.intro),
		sections: draft.sections.map((section) => ({ ...section, items: section.items.map(joined), notes: joined(section.notes) })),
		title: draft.title,
	};
};

export interface Count {
	readonly count: number;
	readonly title: string;
}

export const countsOf = (board: Board): readonly Count[] =>
	board.sections.flatMap((section) => (section.items.length === 0 ? [] : [{ count: section.items.length, title: section.title }]));

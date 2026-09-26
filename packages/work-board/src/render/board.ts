import type { RootContent } from "mdast";
import { markdownToMdast } from "satteri";

export interface Section {
	readonly title: string;
	readonly heading: string;
	readonly notes: string;
	readonly items: ReadonlyArray<string>;
}

export interface Board {
	readonly title: string;
	readonly intro: string;
	readonly sections: ReadonlyArray<Section>;
	readonly footer: string;
	readonly definitions: string;
}

interface Draft {
	title: string;
	intro: string[];
	sections: Array<{ title: string; heading: string; notes: string[]; items: string[][] }>;
	footer: string[] | undefined;
	definitions: string[];
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
		draft.sections.push({ title: textOf(node), heading: source, notes: [], items: [] });
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

const joined = (blocks: ReadonlyArray<string>): string => blocks.join("\n\n");

export const boardOf = (source: string): Board => {
	const draft: Draft = { title: "", intro: [], sections: [], footer: undefined, definitions: [] };
	const root = markdownToMdast(source);
	const nodes = root.type === "root" ? root.children : [];
	const lastHeading = nodes.findLastIndex((node) => node.type === "heading");
	nodes.forEach((node, index) => {
		place(draft, node, source.slice(node.position?.start.offset, node.position?.end.offset), index > lastHeading);
	});
	return {
		title: draft.title,
		intro: joined(draft.intro),
		sections: draft.sections.map((section) => ({ ...section, notes: joined(section.notes), items: section.items.map(joined) })),
		footer: joined(draft.footer ?? []),
		definitions: joined(draft.definitions),
	};
};

export interface Count {
	readonly title: string;
	readonly count: number;
}

export const countsOf = (board: Board): ReadonlyArray<Count> =>
	board.sections.flatMap((section) => (section.items.length === 0 ? [] : [{ title: section.title, count: section.items.length }]));

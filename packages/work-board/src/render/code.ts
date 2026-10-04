import type { Element, ElementContent } from "hast";
import { defineHastPlugin } from "satteri";
import { type BundledLanguage, bundledLanguages, type Highlighter as Shiki } from "shiki";
import { THEMES } from "./highlighter.ts";

const languageOf = (code: Element): string | undefined => {
	const classes = code.properties.className;
	const named = Array.isArray(classes) ? classes.find((name) => String(name).startsWith("language-")) : undefined;
	return named === undefined ? undefined : String(named).slice("language-".length);
};

const textOf = (node: ElementContent): string => {
	if (node.type === "text") {
		return node.value;
	}
	return node.type === "element" ? node.children.map(textOf).join("") : "";
};

const diagram = (source: string): Element => ({
	children: [{ children: [{ type: "text", value: source }], properties: { className: ["diagram-source"] }, tagName: "pre", type: "element" }],
	properties: { className: ["diagram"], dataState: "pending" },
	tagName: "figure",
	type: "element",
});

const isBundled = (language: string): language is BundledLanguage => Object.hasOwn(bundledLanguages, language);

const highlighted = async (highlighter: Shiki, source: string, language: string) => {
	if (!isBundled(language)) {
		return undefined;
	}
	await highlighter.loadLanguage(language);
	return highlighter.codeToHast(source, { defaultColor: false, lang: language, themes: THEMES }).children.at(0);
};

export const codeBlocks = (highlighter: Shiki) =>
	defineHastPlugin({
		element: {
			filter: ["pre"],
			visit: async (pre) => {
				const [code] = pre.children;
				if (code?.type !== "element" || code.tagName !== "code") {
					return undefined;
				}
				const language = languageOf(code);
				const source = textOf(code);
				if (language === "mermaid") {
					return diagram(source);
				}
				return language === undefined ? undefined : await highlighted(highlighter, source, language);
			},
		},
		name: "work-board-code",
	});

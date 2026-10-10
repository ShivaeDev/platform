import type { Element, ElementContent, Root } from "hast";
import { type BundledLanguage, bundledLanguages, type Highlighter as Shiki } from "shiki";
import { visit as visitElements } from "unist-util-visit";
import { THEMES } from "./highlighter.ts";

function languageOf(code: Element): string | undefined {
	const classes = code.properties.className;
	const named = Array.isArray(classes) ? classes.find((name) => String(name).startsWith("language-")) : undefined;
	return named === undefined ? undefined : String(named).slice("language-".length);
}

function textOf(node: ElementContent): string {
	if (node.type === "text") {
		return node.value;
	}
	return node.type === "element" ? node.children.map(textOf).join("") : "";
}

function diagram(source: string): Element {
	return {
		children: [{ children: [{ type: "text", value: source }], properties: { className: ["diagram-source"] }, tagName: "pre", type: "element" }],
		properties: { className: ["diagram"], dataState: "pending" },
		tagName: "figure",
		type: "element",
	};
}

function isBundled(language: string): language is BundledLanguage {
	return Object.hasOwn(bundledLanguages, language);
}

async function highlighted(highlighter: Shiki, source: string, language: string) {
	if (!isBundled(language)) {
		return undefined;
	}
	await highlighter.loadLanguage(language);
	return highlighter.codeToHast(source, { defaultColor: false, lang: language, themes: THEMES }).children.at(0);
}

async function renderedCode(highlighter: Shiki, pre: Element) {
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
}

export const codeBlocks = (highlighter: Shiki) => () => async (tree: Root) => {
	const work: Promise<void>[] = [];
	visitElements(tree, "element", (pre, index, parent) => {
		if (pre.tagName !== "pre" || index === undefined || parent === undefined) {
			return;
		}
		work.push(
			renderedCode(highlighter, pre).then((result) => {
				if (result?.type === "element") {
					parent.children[index] = result;
				}
			}),
		);
	});
	await Promise.all(work);
};

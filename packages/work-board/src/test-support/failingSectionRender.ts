import type { Nodes, Root } from "hast";
import { vi } from "vitest";
import { screenStory } from "./screenStory.ts";

const failure = vi.hoisted(() => {
	const state: { marker: string | undefined } = { marker: undefined };
	return state;
});

function mentions(node: Nodes, marker: string): boolean {
	return node.type === "text" ? node.value === marker : "children" in node && node.children.some((child) => mentions(child, marker));
}

// Highlighting loads grammar chunks over the network, which makes it the step where a real section render fails.
vi.mock("#client/document/highlight.ts", async (importOriginal) => {
	const actual = await importOriginal<{ readonly highlightDocument: () => (tree: Root) => Promise<void> }>();
	return {
		highlightDocument: () => {
			const highlight = actual.highlightDocument();
			return async (tree: Root) => {
				if (failure.marker !== undefined && mentions(tree, failure.marker)) {
					throw new Error(`Rendering failed on ${failure.marker}`);
				}
				await highlight(tree);
			};
		},
	};
});

function recover() {
	failure.marker = undefined;
}

export function failingSectionRender(marker: string) {
	return screenStory.trait("workspace", `rendering fails on the section with the text "${marker}"`, (engine) => {
		failure.marker = marker;
		engine.cleanups.push(async () => recover());
	});
}

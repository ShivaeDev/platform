import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, vi } from "vitest";
import type { Document } from "#browser/document/schema.ts";
import { DocumentView } from "#browser/document/View.ts";
import { metadataParse } from "#metadata/parse.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
	for (const close of cleanups.splice(0).reverse()) {
		await close();
	}
	vi.restoreAllMocks();
});

export function documentData(source: string): Document {
	const parsed = metadataParse(source);
	return {
		diagnostics: [],
		file: "nested/reading.md",
		links: { "task.md": "/resolved-task.md" },
		metadata: parsed.fields,
		modified: 0,
		questionActions: {},
		references: {},
		requests: [],
		source: parsed.body,
		unavailable: [],
		writable: false,
	};
}
export async function mountDocument(document: Document, idPrefix = "") {
	const errors = vi.spyOn(console, "error");
	const container = window.document.createElement("div");
	window.document.body.append(container);
	const root = createRoot(container);
	cleanups.push(async () => {
		await act(async () => root.unmount());
		container.remove();
		expect(errors.mock.calls).toEqual([]);
	});
	async function render(next: Document) {
		await act(async () => root.render(createElement(DocumentView, { document: next, idPrefix })));
	}
	await render(document);
	return { container, render };
}
export async function settledDocument(check: () => void) {
	await vi.waitFor(
		async () => {
			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
			});
			check();
		},
		{ timeout: 10_000 },
	);
}

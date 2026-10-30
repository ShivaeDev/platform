import { Clock, Effect } from "effect";
import { act, createElement } from "react";
import { render } from "@shivaedev/test-story/client/react.ts";
import type { Document } from "#browser/document/schema.ts";
import { DocumentView } from "#client/document/View.ts";
import { metadataParse } from "#server/metadata/parse.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
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
	const view = await render(createElement(DocumentView, { document, idPrefix }));
	return { ...view, render: (next: Document) => view.render(createElement(DocumentView, { document: next, idPrefix })) };
}
export async function settledDocument(check: () => void) {
	const deadline = Effect.runSync(Clock.currentTimeMillis) + 10_000;
	for (;;) {
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
		});
		try {
			check();
			return;
		} catch (error) {
			if (Effect.runSync(Clock.currentTimeMillis) >= deadline) {
				throw error;
			}
		}
	}
}

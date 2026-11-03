import { createElement } from "react";
import { render } from "@shivaedev/test-story/client/adapters/react.ts";
import type { Document } from "#browser/document/schema.ts";
import { DocumentView } from "#client/document/View.ts";
import { metadataParse } from "#metadata/adapters/parse.ts";

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

import { createElement } from "react";
import { QueryView } from "#client/QueryView.ts";
import type { QueryState } from "#client/resultState.ts";
import type { SubtitleRejected } from "#test/compiler-fixtures/notes.ts";

export function queryViewUnhandled(query: QueryState<string, SubtitleRejected>) {
	return createElement(QueryView<string, SubtitleRejected>, { content: (title) => title, query });
}

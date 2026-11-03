import { defineService } from "@shivaedev/service/defineService.ts";
import { makeHighlighter } from "#server/adapters/makeHighlighter.ts";

export const Highlighter = defineService({
	id: "@shivaedev/work-board/Highlighter",
	initialize: makeHighlighter,
	methods: (highlighter) => highlighter,
	requires: [],
});
export type Highlighter = typeof Highlighter.Identifier;

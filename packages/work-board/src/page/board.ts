import { Effect } from "effect";
import { type Board, countsOf, type Section } from "../render/board.ts";
import { renderMarkdown } from "../render/markdown.ts";
import { escapeHtml } from "./escape.ts";
import { updated } from "./updated.ts";

const counts = (board: Board): string =>
	countsOf(board)
		.map(({ count, title }) => `<span><b>${count}</b> ${escapeHtml(title.toLowerCase())}</span>`)
		.join(" · ");

type Render = (fragment: string) => ReturnType<typeof renderMarkdown>;

const section = Effect.fn("WorkBoard.section")(function* ({ heading, items, notes }: Section, render: Render) {
	const rendered = yield* Effect.forEach(items, (item) => Effect.map(render(item), (html) => `<article class="item">${html}</article>`));
	const note = notes === "" ? "" : `<div class="notes">${yield* render(notes)}</div>`;
	return `<section>${yield* render(heading)}${note}${rendered.join("")}</section>`;
});

export const boardHtml = Effect.fn("WorkBoard.boardHtml")(function* (board: Board, fallbackTitle: string, modified: number) {
	let fragments = 0;
	const render: Render = (fragment) => {
		fragments += 1;
		return renderMarkdown(board.definitions === "" ? fragment : `${fragment}\n\n${board.definitions}`, `part-${fragments}-`);
	};
	const title = board.title === "" ? `<h1>${escapeHtml(fallbackTitle)}</h1>` : yield* render(board.title);
	const intro = board.intro === "" ? "" : `<div class="intro">${yield* render(board.intro)}</div>`;
	const sections = yield* Effect.forEach(board.sections, (each) => section(each, render));
	const footer = board.footer === "" ? "" : `<footer>${yield* render(board.footer)}</footer>`;
	return [
		`<header class="board-head">${title}${intro}`,
		`<p class="counts">${counts(board)}</p>`,
		`<p class="meta">${updated(modified)}</p></header>`,
		`<div class="board">${sections.join("")}</div>`,
		footer,
	].join("");
});

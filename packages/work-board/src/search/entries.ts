import { defineHastPlugin, markdownToHtml } from "satteri";
import { fileUrl } from "#files/url.ts";
import { boardOf } from "#render/board.ts";
import { documentHeadings } from "#render/documentHeadings.ts";

export interface Entry {
	readonly file: string;
	readonly href: string;
	readonly kind: "document" | "heading" | "passage";
	readonly text: string;
	readonly title: string;
}

export async function entriesOf(source: string, file: string, home: boolean): Promise<readonly Entry[]> {
	const headings = documentHeadings();
	const entries: Entry[] = [];
	let passage = "";
	let label = file;
	const collect = defineHastPlugin({
		element: {
			filter: ["h1", "h2", "h3", "h4", "h5", "h6", "p", "pre", "li", "td", "th"],
			visit: (element, context) => {
				const text = context.textContent(element).replace(/\s+/gu, " ").trim();
				if (!text || element.properties.id === "footnote-label") {
					return;
				}
				const heading = element.tagName.startsWith("h") && element.tagName !== "th";
				if (heading && typeof element.properties.id === "string") {
					passage = element.properties.id;
					label = text;
				}
				entries.push({
					file,
					href: fileUrl(file) + (passage ? `#${encodeURIComponent(passage)}` : ""),
					kind: heading ? "heading" : "passage",
					text,
					title: label,
				});
			},
		},
		name: "work-board-search-text",
	});
	const board = home ? boardOf(source) : undefined;
	const fragments = board
		? [board.title, board.intro, ...board.sections.flatMap((section) => [section.heading, section.notes, ...section.items]), board.footer]
		: [source];
	for (const fragment of fragments) {
		if (fragment) {
			await markdownToHtml(board?.definitions ? `${fragment}\n\n${board.definitions}` : fragment, { hastPlugins: [headings.plugin, collect] });
		}
	}
	const title = headings.entries.find((heading) => heading.depth === 1)?.title || file;
	return [{ file, href: fileUrl(file), kind: "document", text: `${file} ${title}`, title }, ...entries];
}

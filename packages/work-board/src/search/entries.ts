import { MarkdownAsync } from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { fileUrl } from "#files/url.ts";
import { boardOf } from "#render/board.ts";
import { documentHeadings } from "#render/documentHeadings.ts";
import { searchCollector } from "./collector.ts";
import { linkCollector } from "./linkCollector.ts";

export interface Entry {
	readonly file: string;
	readonly href: string;
	readonly kind: "document" | "heading" | "passage";
	readonly line?: number;
	readonly text: string;
	readonly title: string;
}

function fragmentLocation(source: string, fragment: string, bodyLine: number, seen: Map<string, number>): number | undefined {
	const start = source.indexOf(fragment, seen.get(fragment) ?? 0);
	if (start < 0) {
		return undefined;
	}
	seen.set(fragment, start + fragment.length);
	return bodyLine + source.slice(0, start).split("\n").length - 1;
}

export async function entriesOf(source: string, file: string, home: boolean, bodyLine = 1, links = new Set<string>()): Promise<readonly Entry[]> {
	const headings = documentHeadings();
	let fragmentLine: number | undefined = bodyLine;
	let fragmentLength = 0;
	const seenFragments = new Map<string, number>();
	const { entries, plugin } = searchCollector(
		file,
		() => fragmentLine,
		() => fragmentLength,
	);
	const board = home ? boardOf(source) : undefined;
	const fragments = board
		? [board.title, board.intro, ...board.sections.flatMap((section) => [section.heading, section.notes, ...section.items]), board.footer]
		: [source];
	for (const fragment of fragments) {
		if (fragment) {
			fragmentLength = fragment.split("\n").length;
			fragmentLine = board ? fragmentLocation(source, fragment, bodyLine, seenFragments) : bodyLine;
			await MarkdownAsync({
				children: board?.definitions ? `${fragment}\n\n${board.definitions}` : fragment,
				rehypePlugins: [rehypeRaw, headings.plugin, plugin, linkCollector(links)],
				remarkPlugins: [remarkGfm],
			});
		}
	}
	const title = headings.entries.find((heading) => heading.depth === 1)?.title || file;
	return [{ file, href: fileUrl(file), kind: "document", line: bodyLine, text: `${file} ${title}`, title }, ...entries];
}

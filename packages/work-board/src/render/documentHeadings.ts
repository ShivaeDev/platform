import { defineHastPlugin } from "satteri";

export interface Heading {
	readonly depth: number;
	readonly id: string;
	readonly title: string;
}

export function documentHeadings() {
	const entries: Heading[] = [];
	const used = new Set<string>();
	const plugin = defineHastPlugin({
		element: {
			filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
			visit: (element, context) => {
				if (element.properties.id !== undefined) {
					return;
				}
				const title = context.textContent(element).trim();
				const slug =
					title
						.normalize("NFKC")
						.toLowerCase()
						.replace(/[^\p{Letter}\p{Number}\s_-]/gu, "")
						.trim()
						.replace(/\s+/gu, "-") || "section";
				const base = `heading-${slug}`;
				let id = base;
				for (let suffix = 2; used.has(id); suffix += 1) {
					id = `${base}-${suffix}`;
				}
				used.add(id);
				entries.push({ depth: Number(element.tagName.slice(1)), id, title });
				return {
					...element,
					children: [
						...element.children,
						{
							children: [],
							properties: { ariaLabel: `Link to ${title || "section"}`, className: ["heading-anchor"], href: `#${id}` },
							tagName: "a",
							type: "element" as const,
						},
					],
					properties: { ...element.properties, id, tabIndex: -1 },
				};
			},
		},
		name: "work-board-headings",
	});
	return { entries, plugin };
}

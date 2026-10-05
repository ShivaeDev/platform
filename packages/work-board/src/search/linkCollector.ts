import { defineHastPlugin } from "satteri";

export function linkCollector(links: Set<string>) {
	return defineHastPlugin({
		element: {
			filter: ["a"],
			visit: (element) => {
				const href = element.properties.href;
				if (typeof href === "string" && !href.startsWith("#")) {
					links.add(href);
				}
			},
		},
		name: "work-board-link-collector",
	});
}

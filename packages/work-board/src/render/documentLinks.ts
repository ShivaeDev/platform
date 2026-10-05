import { defineHastPlugin } from "satteri";
import { fileUrl } from "#files/url.ts";

export function documentLinks(file: string) {
	return defineHastPlugin({
		element: {
			filter: ["a"],
			visit: (element) => {
				const href = element.properties.href;
				if (typeof href !== "string" || href.startsWith("#") || href.startsWith("/") || /^[a-z][a-z\d+.-]*:/iu.exec(href) !== null) {
					return;
				}
				const target = new URL(href, `http://work-board.local${fileUrl(file)}`);
				return { ...element, properties: { ...element.properties, href: target.pathname + target.search + target.hash } };
			},
		},
		name: "work-board-document-links",
	});
}

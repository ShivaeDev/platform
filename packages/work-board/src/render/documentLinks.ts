import { defineHastPlugin } from "satteri";
import { fileUrl } from "#files/url.ts";
import { attachmentHref } from "#path/attachment.ts";

export function documentLinks(file: string) {
	return defineHastPlugin({
		element: {
			filter: ["a", "img"],
			visit: (element) => {
				const attribute = element.tagName === "img" ? "src" : "href";
				const href = element.properties[attribute];
				if (typeof href !== "string" || href.startsWith("#") || href.startsWith("//") || /^[a-z][a-z\d+.-]*:/iu.exec(href) !== null) {
					return;
				}
				const target = new URL(href, `http://work-board.local${fileUrl(file)}`);
				const resolved = target.pathname + target.search + target.hash;
				const image = attachmentHref(resolved);
				return {
					...element,
					properties: {
						...element.properties,
						[attribute]: image ?? resolved,
						...(element.tagName === "img" && image ? { dataLocalImage: image } : {}),
					},
				};
			},
		},
		name: "work-board-document-links",
	});
}

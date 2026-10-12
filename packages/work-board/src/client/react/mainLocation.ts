export interface MainLocation {
	readonly file: string;
	readonly view: string;
}
export function bootstrapPage(html: string): Document {
	const page = new DOMParser().parseFromString(/<body[^>]*>(?<body>[\s\S]*)<\/body>/iu.exec(html)?.groups?.body ?? html, "text/html");
	const template = page.querySelector<HTMLTemplateElement>("#board-legacy-page");
	if (template) {
		page.body.replaceChildren(template.content.cloneNode(true));
	}
	return page;
}

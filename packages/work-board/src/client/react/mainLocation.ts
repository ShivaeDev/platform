export interface MainLocation {
	readonly file: string;
	readonly title?: string | undefined;
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

export function displayedLocation(main: HTMLElement | null): MainLocation {
	const file = main?.dataset.file ?? "";
	const title = main?.querySelector("h1")?.textContent?.trim();
	return { file, title, view: main?.dataset.view ?? "" };
}
export function sameMainLocation(previous: MainLocation, next: MainLocation) {
	return previous.file === next.file && previous.view === next.view && previous.title === next.title;
}

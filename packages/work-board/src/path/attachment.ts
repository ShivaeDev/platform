const TYPES: Readonly<Record<string, string>> = {
	gif: "image/gif",
	jpeg: "image/jpeg",
	jpg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
};

export function attachmentType(file: string): string | undefined {
	const extension = file.split(".").at(-1)?.toLowerCase() ?? "";
	return Object.hasOwn(TYPES, extension) ? TYPES[extension] : undefined;
}

export function attachmentHref(href: string): string | undefined {
	if (!href.startsWith("/") || href.startsWith("//")) {
		return undefined;
	}
	const url = new URL(href, "http://work-board.local");
	if (url.pathname.startsWith("/_board/attachment/")) {
		return href;
	}
	return attachmentType(url.pathname) ? `/_board/attachment${url.pathname}${url.search}${url.hash}` : undefined;
}

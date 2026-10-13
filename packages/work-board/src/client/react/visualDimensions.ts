export function graphicWidth(graphic: Element | null | undefined) {
	if (graphic instanceof HTMLImageElement) {
		return graphic.naturalWidth;
	}
	if (graphic instanceof SVGSVGElement) {
		return graphic.viewBox?.baseVal?.width;
	}
	return undefined;
}

export function visualFilename(local: string | undefined) {
	if (!local) {
		return "work-board-diagram.svg";
	}
	try {
		return decodeURIComponent(new URL(local, location.href).pathname.split("/").at(-1) ?? "work-board-image");
	} catch {
		return "work-board-image";
	}
}

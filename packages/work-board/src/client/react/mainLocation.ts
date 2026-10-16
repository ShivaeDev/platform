export interface MainLocation {
	readonly file: string;
	readonly title?: string | undefined;
	readonly view: string;
}
export function displayedLocation(main: HTMLElement | null): MainLocation {
	const file = main?.dataset.file ?? "";
	const title = main?.querySelector("h1")?.textContent?.trim();
	return { file, title, view: main?.dataset.view ?? "" };
}
export function sameMainLocation(previous: MainLocation, next: MainLocation) {
	return previous.file === next.file && previous.view === next.view && previous.title === next.title;
}

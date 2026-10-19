export function responseUrl(item: string, request: string): string {
	return `/_board/item/${encodeURIComponent(item)}/#${encodeURIComponent(`answer-card-${request}`)}`;
}

// Old /_board/result?item= links still sit in project notes and agent prompts, so they land on the item page.
export function resultUrl(item: string | null): string {
	return item ? `/_board/item/${encodeURIComponent(item)}/` : "/_board/library?kind=result";
}

export function responseUrl(item: string, request: string): string {
	return `/_board/item/${encodeURIComponent(item)}/#${encodeURIComponent(`answer-card-${request}`)}`;
}

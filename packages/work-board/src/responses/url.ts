export function responseUrl(item: string, request: string): string {
	return `/_board/respond?item=${encodeURIComponent(item)}&request=${encodeURIComponent(request)}`;
}

const entities: Readonly<Record<string, string>> = { "'": "&#39;", '"': "&quot;", "&": "&amp;", "<": "&lt;", ">": "&gt;" };

export function escapeHtml(text: string): string {
	return text.replaceAll(/[&<>"']/gu, (character) => entities[character] ?? character);
}

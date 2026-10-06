function skipped(segment: string): boolean {
	return segment.startsWith(".") || segment === "node_modules";
}
export function isMarkdown(path: string): boolean {
	return path.endsWith(".md") && !path.split("/").some(skipped);
}

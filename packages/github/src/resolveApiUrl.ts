export function resolveApiUrl(apiUrl: string, path: string) {
	const base = new URL(apiUrl);
	base.pathname = `${base.pathname.replace(/\/$/u, "")}/`;
	return new URL(path.replace(/^\/(?!\/)/u, ""), base).href;
}

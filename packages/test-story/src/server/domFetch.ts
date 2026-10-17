export function domFetch(baseUrl: string): typeof globalThis.fetch {
	const base = new URL(baseUrl);
	window.location.href = base.href;
	const transport = window.fetch.bind(window);
	return (input, init) => transport(typeof input === "string" ? new URL(input, base).href : input, init);
}

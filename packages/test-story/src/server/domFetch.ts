export function domFetch(baseUrl: string): typeof globalThis.fetch {
	const base = new URL(baseUrl);
	window.location.href = base.href;
	const transport = window.fetch.bind(window);
	return (input, init) => {
		if (input instanceof Request) {
			const request = new Request(input, init);
			return transport(request.url, {
				body: request.body,
				cache: request.cache,
				credentials: request.credentials,
				headers: [...request.headers],
				method: request.method,
				mode: request.mode,
				redirect: request.redirect,
				referrer: request.referrer,
				referrerPolicy: request.referrerPolicy,
				signal: request.signal,
			});
		}
		return transport(
			typeof input === "string" ? new URL(input, base).href : input,
			init?.headers instanceof Headers ? { ...init, headers: [...init.headers] } : init,
		);
	};
}

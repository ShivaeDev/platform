export function visitHttp(url: string, init: RequestInit, signal: AbortSignal) {
	return fetch(url, { ...init, redirect: "manual", signal: init.signal ? AbortSignal.any([signal, init.signal]) : signal });
}

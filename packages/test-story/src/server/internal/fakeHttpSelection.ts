import type { FakeHttpRequest, FakeHttpScope } from "#fakeHttpService.ts";

export function fakeHttpSelection(route: string, scope: FakeHttpScope = {}) {
	const params = Object.entries(scope.params ?? {}).sort(([left], [right]) => left.localeCompare(right));
	const label = params.length > 0 ? `${route} matching ${JSON.stringify(Object.fromEntries(params))}` : route;
	return {
		label,
		matches: (name: string, request: FakeHttpRequest) => name === route && params.every(([key, value]) => request.params[key] === value),
	};
}

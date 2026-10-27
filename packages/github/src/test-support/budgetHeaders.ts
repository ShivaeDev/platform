export function budgetHeaders(resource: string, remaining: number, reset: number) {
	return {
		"x-ratelimit-limit": "5000",
		"x-ratelimit-remaining": String(remaining),
		"x-ratelimit-reset": String(reset),
		"x-ratelimit-resource": resource,
		"x-ratelimit-used": String(5000 - remaining),
	};
}

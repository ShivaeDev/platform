export interface Budget {
	readonly limit: number;
	readonly remaining: number;
	readonly reset: number;
}

export function budgetHeaders(resource: string, { limit, remaining, reset }: Budget) {
	return {
		"x-ratelimit-limit": String(limit),
		"x-ratelimit-remaining": String(remaining),
		"x-ratelimit-reset": String(reset),
		"x-ratelimit-resource": resource,
		"x-ratelimit-used": String(limit - remaining),
	};
}

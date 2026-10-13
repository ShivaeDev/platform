import type { HttpClientResponse } from "effect/http";

export interface Budget {
	blockedUntil: number;
	limit: number;
	remaining: number;
	reset: number;
}
function numeric(headers: Readonly<Record<string, string>>, name: string): number | undefined {
	const value = headers[name];
	return value !== undefined && Number.isFinite(Number(value)) ? Number(value) : undefined;
}
export function observeBudget(budget: Budget, response: Pick<HttpClientResponse.HttpClientResponse, "headers" | "status">, now: number): void {
	budget.remaining = numeric(response.headers, "x-ratelimit-remaining") ?? budget.remaining;
	budget.limit = numeric(response.headers, "x-ratelimit-limit") ?? budget.limit;
	budget.reset = (numeric(response.headers, "x-ratelimit-reset") ?? budget.reset / 1000) * 1000;
	if (response.status === 429 || response.status === 403) {
		const retry = response.headers["retry-after"] ?? null;
		const until = retryUntil(retry, now);
		budget.blockedUntil = Math.max(budget.blockedUntil, Number.isFinite(until) ? until : now + 60_000);
	}
	if (budget.remaining === 0) {
		budget.blockedUntil = Math.max(budget.blockedUntil, budget.reset);
	}
}
export function pollDelay(budget: Budget, interval: number, requests: number, now: number): number {
	const ratio = budget.remaining / Math.max(1, budget.limit);
	const multiplier = slowdown(ratio);
	const paced = budget.remaining > 0 && ratio < 0.5 ? Math.ceil((Math.max(0, budget.reset - now) * requests) / budget.remaining) : 0;
	return Math.max(interval * multiplier, paced, budget.blockedUntil - now);
}
function retryUntil(retry: string | null, now: number): number {
	if (retry === null) {
		return now + 60_000;
	}
	if (Number.isFinite(Number(retry))) {
		return now + Number(retry) * 1000;
	}
	return Date.parse(retry);
}
function slowdown(ratio: number): number {
	if (ratio < 0.1) {
		return 10;
	}
	if (ratio < 0.2) {
		return 5;
	}
	if (ratio < 0.5) {
		return 2;
	}
	return 1;
}

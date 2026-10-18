import type { AnyTRPCRouter } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import superjson from "superjson";

export interface Exchange {
	readonly body: string;
	readonly status: number;
}

export function inProcess(router: AnyTRPCRouter, createContext = () => ({})) {
	const exchanges: Exchange[] = [];
	async function fetch(input: RequestInfo | URL, init?: RequestInit | { readonly signal?: AbortSignal | null | undefined }) {
		const request = new Request(input, { ...init, signal: init?.signal ?? null });
		const response = await fetchRequestHandler({ createContext, endpoint: "/trpc", req: request, router });
		exchanges.push({ body: await response.clone().text(), status: response.status });
		return response;
	}
	return { exchanges, fetch, transformer: superjson, url: "http://localhost/trpc" };
}

export async function failureOf(call: Promise<unknown>): Promise<unknown> {
	try {
		await call;
	} catch (error) {
		return error;
	}
	throw new Error("Expected the call to fail");
}

import type { AnyTRPCRouter } from "@trpc/server";
import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Layer, ManagedRuntime } from "effect";
import superjson from "superjson";
import { makeEffectTRPC } from "#adapter.ts";
import { rejectionFormatter } from "#rejection-formatter.ts";
import { makeRequestServices } from "#request-services.ts";

export const runtime = ManagedRuntime.make(Layer.empty);

export const t = initTRPC.create({ errorFormatter: rejectionFormatter, transformer: superjson });

export const procedure = makeEffectTRPC({ runtime }).procedure(
	t.procedure,
	makeRequestServices(() => Layer.empty),
);

export interface Exchange {
	readonly body: string;
	readonly status: number;
}

export function inProcess(router: AnyTRPCRouter) {
	const exchanges: Exchange[] = [];
	async function fetch(input: RequestInfo | URL, init?: RequestInit | { readonly signal?: AbortSignal | null | undefined }) {
		const request = new Request(input, { ...init, signal: init?.signal ?? null });
		const response = await fetchRequestHandler({ createContext: () => ({}), endpoint: "/trpc", req: request, router });
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

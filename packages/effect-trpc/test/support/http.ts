import type { AnyTRPCRouter } from "@trpc/server";
import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Layer, ManagedRuntime } from "effect";
import superjson from "superjson";
import { makeEffectTRPC, makeRequestServices, rejectionFormatter } from "#index.ts";

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

export const inProcess = (router: AnyTRPCRouter) => {
	const exchanges: Exchange[] = [];
	const fetch = async (input: RequestInfo | URL, init?: RequestInit | { readonly signal?: AbortSignal | null | undefined }) => {
		const request = new Request(input, { ...init, signal: init?.signal ?? null });
		const response = await fetchRequestHandler({ createContext: () => ({}), endpoint: "/trpc", req: request, router });
		exchanges.push({ body: await response.clone().text(), status: response.status });
		return response;
	};
	return { exchanges, fetch, transformer: superjson, url: "http://localhost/trpc" };
};

export const failureOf = async (call: Promise<unknown>): Promise<unknown> => {
	try {
		await call;
	} catch (error) {
		return error;
	}
	throw new Error("Expected the call to fail");
};

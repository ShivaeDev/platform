import type { Agent } from "node:http";
import { type Cause, Effect, Layer, type LogLevel, type Tracer } from "effect";
import type { HttpRouter, HttpServer } from "effect/http";
import type { disconnectProxy } from "@shivaedev/test-sql/server/disconnectProxy.ts";
import type { PlatformRuntime } from "#runtime/types.ts";
import { otlpHost } from "#test/otlpHost.ts";
import type { otlpReceiver } from "#test/otlpReceiver.ts";
import type { ClientAbortState } from "./clientAbortFixture.ts";
import type { SubscriptionState } from "./subscription.ts";

export interface HostState {
	address: unknown;
	adminSession: { role: string; unavailable: boolean };
	agent?: Agent;
	assets?: { root: string; spa: boolean };
	bindAddress: string;
	bootFailure?: import("effect").Cause.Cause<unknown>;
	build: (state: HostState) => Layer.Layer<HttpServer.HttpServer, unknown>;
	calls: (string | Buffer)[];
	cleanup: (() => void | Promise<void>)[];
	clientAbort?: ClientAbortState;
	config: { port?: number; host?: string; trustedProxy?: string; maxBodySize?: number; sensitiveKeys?: readonly string[] };
	env: Record<string, string>;
	expectBootFailure: boolean;
	lifecycle: string[];
	logs: { level: string; attempt: number; annotations: Record<string, unknown>; message: unknown; spans?: Readonly<Record<string, number>> }[];
	lookups: string[];
	loopback: boolean;
	minimumLogLevel: LogLevel.LogLevel;
	nativeSpans: Tracer.NativeSpan[];
	proxy?: Effect.Success<ReturnType<typeof disconnectProxy>>;
	receiver?: Awaited<ReturnType<typeof otlpReceiver>>;
	reported: Cause.Cause<unknown>[];
	routes: Layer.Layer<never, never, HttpRouter.HttpRouter | HttpRouter.Request<"Error", unknown>>;
	rpcPath: HttpRouter.PathInput;
	runtime?: PlatformRuntime<HttpServer.HttpServer, unknown>;
	runtimeLifecycle: string[];
	subscription?: SubscriptionState;
	url: string;
}

export function emptyHost(): HostState {
	return {
		address: undefined,
		adminSession: { role: "user", unavailable: false },
		bindAddress: "",
		build: (state) => otlpHost(state),
		calls: [],
		cleanup: [],
		config: { port: 0 },
		env: {},
		expectBootFailure: false,
		lifecycle: [],
		logs: [],
		lookups: [],
		loopback: true,
		minimumLogLevel: "Info",
		nativeSpans: [],
		reported: [],
		routes: Layer.empty,
		rpcPath: "/rpc",
		runtimeLifecycle: [],
		url: "",
	};
}

export function runtimeOf(state: HostState) {
	if (state.runtime === undefined) {
		throw new Error("The app host has not been constructed");
	}
	return state.runtime;
}
export function io<A>(action: () => Promise<A>) {
	return Effect.tryPromise({ catch: (error) => error, try: action });
}

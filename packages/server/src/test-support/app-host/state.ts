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
	applicationName?: string;
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
	logWaiters: (() => void)[];
	lookups: string[];
	loopback: boolean;
	minimumLogLevel: LogLevel.LogLevel;
	nativeSpans: Tracer.NativeSpan[];
	proxy?: Effect.Success<ReturnType<typeof disconnectProxy>>;
	receiver?: Awaited<ReturnType<typeof otlpReceiver>>;
	reported: Cause.Cause<unknown>[];
	response?: {
		readonly answers?: Readonly<Record<string, string>>;
		readonly body?: string;
		readonly cacheControl: string | null;
		readonly status: number;
	};
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
		logWaiters: [],
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

export function logged(state: HostState, condition: () => boolean): Promise<void> {
	return new Promise((resolve) => {
		function check() {
			if (condition()) {
				resolve();
			} else {
				state.logWaiters.push(check);
			}
		}
		check();
	});
}

export function recordLog(state: HostState, entry: HostState["logs"][number]) {
	state.logs.push(entry);
	queueMicrotask(() => {
		for (const waiter of state.logWaiters.splice(0)) {
			waiter();
		}
	});
}

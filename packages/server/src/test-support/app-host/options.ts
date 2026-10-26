import { Effect, Layer, Redacted } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { Migrator } from "effect/sql";
import { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import { appHost } from "#appHost.ts";
import { sessions, staticAssets } from "./fixture.ts";
import { useForwardingProxy } from "./lifecycle.ts";
import { Ping, pingHandlers } from "./ping.ts";
import { runtimeRoutes } from "./runtimeRoutes.ts";
import { host } from "./story.ts";

export const assets = host.trait("configured", "the host serves the fixture SPA and a readiness route", (state) =>
	Effect.promise(async () => {
		const files = await staticAssets();
		state.cleanup.push(files.close);
		state.assets = { root: files.path, spa: true };
		state.routes = HttpRouter.add("GET", "/ready", HttpServerResponse.text("Ready"));
	}),
);
export const forwarded = host.trait("listening", "HTTP reaches the host through a forwarding proxy", useForwardingProxy);
export const lifecycleServices = host.trait("configured", "application services own a scope", (state) => {
	state.build = () =>
		appHost({
			config: state.config,
			group: Ping,
			handlers: pingHandlers,
			services: Layer.effectDiscard(
				Effect.acquireRelease(
					Effect.sync(() => {
						state.lifecycle.push("started");
					}),
					() =>
						Effect.sync(() => {
							state.lifecycle.push("closed");
						}),
				),
			),
			sessions: sessions(state.lookups),
		});
});
export const failedRoute = host.trait("configured", "an application route fails with a typed error", (state) => {
	state.routes = HttpRouter.add("GET", "/failed", Effect.fail(new InternalServerError({ message: "Route failed" })));
});
export function rpcPath(path: HttpRouter.PathInput) {
	return host.trait("configured", `RPC is served at ${path}`, (state) => {
		state.rpcPath = path;
	});
}
export const invalidTrust = host.trait("configured", "trust validation precedes migrations, routes and services", (state) => {
	state.build = () =>
		appHost({
			config: { ...state.config, databaseUrl: Redacted.make("postgresql://unused:unused@127.0.0.1:1/unused") },
			group: Ping,
			handlers: pingHandlers,
			migrations: {
				loader: Migrator.fromRecord({
					"001_never": Effect.sync(() => {
						state.lifecycle.push("migrated");
					}),
				}),
			},
			routes: HttpRouter.use(() =>
				Effect.sync(() => {
					state.lifecycle.push("routed");
				}),
			),
			services: Layer.effectDiscard(
				Effect.sync(() => {
					state.lifecycle.push("started");
				}),
			),
			sessions: sessions(state.lookups),
		});
});

export const runtimeApplication = host.trait("configured", "application routes exercise the runtime Promise boundary", (state) => {
	state.routes = runtimeRoutes(state);
});

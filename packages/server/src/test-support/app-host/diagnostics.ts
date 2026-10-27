import { Effect } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { host } from "./story.ts";

function diagnostic(field: string) {
	return `${field} at https://example.test/${field}?code="hidden-${field}-code with spaces"&state=hidden-${field}-state\nmore hidden-${field}-value#"hidden-${field}-fragment with spaces"`;
}

export const sensitiveDiagnostics = host.trait("configured", "a failed route annotates sensitive span fields", (state) => {
	state.env.OTEL_RESOURCE_ATTRIBUTES = "service.name=resource-name,api.token=hidden-resource-token";
	state.routes = HttpRouter.add(
		"GET",
		"/failed",
		Effect.gen(function* () {
			yield* Effect.annotateCurrentSpan({
				authorization: "hidden-authorization",
				cookie: "hidden-cookie",
				"db.user": "hidden-database-user",
				detail: ["Bearer hidden-array-token"],
			});
			const span = yield* Effect.currentSpan.pipe(Effect.orDie);
			span.event("password=hidden-event-password", 0n, { cookie: "hidden-event-cookie" });
			span.addLinks([{ attributes: { authorization: "hidden-link-authorization" }, span }]);
			return yield* Effect.die(new Error("postgres://hidden-database-user:hidden-database-password@localhost/db token=hidden-token"));
		}),
	);
});
export const textDiagnostics = host.trait("configured", "a failed route annotates quoted and spaced URLs", (state) => {
	state.routes = HttpRouter.add(
		"GET",
		"/diagnostics",
		Effect.gen(function* () {
			yield* Effect.annotateCurrentSpan({ detail: diagnostic("attribute") });
			const span = yield* Effect.currentSpan.pipe(Effect.orDie);
			span.event(diagnostic("event"), 0n, { detail: diagnostic("event-attribute") });
			span.addLinks([{ attributes: { detail: diagnostic("link-attribute") }, span }]);
			return yield* Effect.die(new Error(diagnostic("status")));
		}).pipe(Effect.withSpan(diagnostic("span"))),
	);
});
export const tracedRoutes = host.trait("configured", "the router serves a parameterized item route", (state) => {
	state.routes = HttpRouter.add("GET", "/items/:id", HttpServerResponse.text("item"));
});

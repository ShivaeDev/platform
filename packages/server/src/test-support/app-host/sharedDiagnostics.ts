import { Cause, Effect, ErrorReporter, Layer } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { host } from "./story.ts";

export const sharedDiagnostics = host.trait("configured", "a route reports database and URL diagnostics to every sink", (state) => {
	const values = {
		"db.connection_string": "postgres://hidden-user:hidden-password@localhost/app?sslpassword=hidden-query",
		"db.user": "hidden-database-user",
		"db.user.name": "hidden-database-user-name",
		detail: "connect postgres://hidden-user:hidden-password@localhost/app?custom=hidden-query#hidden-fragment",
		"url.query": ["code=hidden-code", "state=hidden-state"],
		visible: "public diagnostic",
	};
	state.routes = HttpRouter.add(
		"GET",
		"/shared-diagnostics",
		Effect.gen(function* () {
			yield* Effect.logInfo("database diagnostics").pipe(Effect.annotateLogs(values));
			yield* ErrorReporter.report(Cause.fail(values));
			yield* Effect.annotateCurrentSpan(values);
			return HttpServerResponse.text("recorded");
		}).pipe(Effect.withSpan("database diagnostics")),
	);
	const build = state.build;
	state.build = () =>
		build(state).pipe(
			Layer.provide(ErrorReporter.layer([{ [ErrorReporter.TypeId]: ErrorReporter.TypeId, report: ({ cause }) => state.reported.push(cause) }])),
		);
});

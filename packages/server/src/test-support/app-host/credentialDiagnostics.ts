import { Effect } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { host } from "./story.ts";

export const credentialDiagnostics = host.trait("configured", "a route annotates signatures and PEM credentials", (state) => {
	const values = {
		error: "error: request failed sig=hidden-error-signature&x=1",
		host: "host/path sig=hidden-bare-signature",
		query: "host/path?sig=hidden-query-signature&x=1",
		shortError: "error: sig=hidden-short-error-signature&x=1",
		sig: "hidden-signature-attribute",
		...Object.fromEntries(
			["PRIVATE KEY", "RSA PRIVATE KEY", "EC PRIVATE KEY", "OPENSSH PRIVATE KEY", "ENCRYPTED PRIVATE KEY"].map((kind, index) => [
				`pem${index}`,
				`before -----BEGIN ${kind}-----\nhidden-key-${index}\nsecond-line\n-----END ${kind}----- after`,
			]),
		),
	};
	state.routes = HttpRouter.add(
		"GET",
		"/credentials",
		Effect.gen(function* () {
			yield* Effect.annotateCurrentSpan(values);
			const span = yield* Effect.currentSpan.pipe(Effect.orDie);
			span.event("credentials", 0n, values);
			return HttpServerResponse.text("credentials");
		}).pipe(Effect.withSpan("credential-redaction")),
	);
});

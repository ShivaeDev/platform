import { Effect } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { Conflict, isConflict } from "@shivaedev/errors/taxonomy.ts";
import { host } from "./story.ts";

export const taxonomyGuards = host.trait("configured", "a route handles Conflict instances by class", (state) => {
	state.routes = HttpRouter.add("GET", "/guard/:kind", (request) =>
		Effect.fail(request.url.endsWith("/instance") ? new Conflict({ message: "taken" }) : { _tag: "Conflict", message: "taken" }).pipe(
			Effect.catchIf(isConflict, () => Effect.succeed(HttpServerResponse.text("class rejection handled"))),
			Effect.catch(() => Effect.succeed(HttpServerResponse.text("unrecognized failure"))),
		),
	);
});

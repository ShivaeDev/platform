import { Effect } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";

export const authEmailRoutes = HttpRouter.use((router) =>
	router.add("GET", "/auth/confirm", (request) => {
		const token = new URL(request.url, "http://localhost").searchParams.get("token") ?? "";
		const query = new URLSearchParams({ "callbackURL": "/sign-in", token });
		return Effect.succeed(HttpServerResponse.redirect(`/api/auth/verify-email?${query}`));
	}),
);

import { expect } from "vitest";
import { Forbidden, NotFound, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { routeReadRefused, routeRequested, routes } from "#test/routerStories.tsx";

routes.it(
	"a signed-out query redirects to sign-in and displays its full return location",
	[routeRequested("/redirected/first?page=2#details")],
	function* ({ heading, location, reject }) {
		yield* reject("first", new Unauthorized({ message: "Sign in" }), 2);

		yield* outcomes([
			["heading", () => heading(), "Sign in to return to /redirected/first?page=2#details"],
			["location", () => location(), "/sign-in?returnTo=%2Fredirected%2Ffirst%3Fpage%3D2%23details"],
		]);
	},
);

const forbidden = new Forbidden({ message: "Not your note" });
routes.it(
	"a forbidden query redirects to the declared refusal route and renders it",
	[routeRequested("/redirected/first")],
	function* ({ heading, location, reject }) {
		yield* reject("first", forbidden);

		yield* outcomes([
			["heading", () => heading(), "Choose a note you can read"],
			["location", () => location(), "/no-access"],
		]);
	},
);

routes.it(
	"a query read-policy refusal redirects to the declared refusal route and renders it",
	[routeReadRefused("/redirected/refused")],
	function* ({ heading, location }) {
		yield* outcomes([
			["heading", () => heading(), "Choose a note you can read"],
			["location", () => location(), "/no-access"],
		]);
	},
);

routes.it(
	"an unconfigured query read-policy refusal keeps the shared not-found screen",
	[routeReadRefused("/notes/refused")],
	function* ({ heading }) {
		expect(yield* heading()).toBe("Page not found");
	},
);

routes.it(
	"a missing query keeps its not-found message when refusal redirects are configured",
	[routeRequested("/redirected/missing")],
	function* ({ heading, location, reject }) {
		yield* reject("missing", new NotFound({ message: "This note was removed" }));

		yield* outcomes([
			["heading", () => heading(), "This note was removed"],
			["location", () => location(), "/redirected/missing?page=1"],
		]);
	},
);

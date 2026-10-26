import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { host } from "#test/hostStory.ts";
import { fixedMainSource } from "#test/mainSource.ts";

export const unavailableMain = host.trait("configuration", "Git observation is unavailable", (engine) => {
	engine.parts = {
		...engine.parts,
		main: fixedMainSource({ refresh: Effect.fail(new ServiceUnavailable({ message: "Git observation unavailable" })), repositoryRoot: "/synthetic" }),
	};
});

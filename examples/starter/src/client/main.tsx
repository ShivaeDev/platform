import { Effect } from "effect";
import { makeAuth } from "#client/adapters/auth.ts";
import { startApp } from "#client/startApp.tsx";
import "#client/main.css";

Effect.runSync(
	Effect.gen(function* () {
		const container = document.getElementById("root");
		if (container === null) {
			return yield* Effect.die(new Error("Missing application root"));
		}
		startApp(container, makeAuth({ baseUrl: window.location.origin }));
	}),
);

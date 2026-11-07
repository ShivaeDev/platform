import { RegistryProvider } from "@effect/atom-react";
import { Effect } from "effect";
import { createRoot } from "react-dom/client";
import { App } from "#client/App.tsx";
import { makeAuth } from "#client/adapters/auth.ts";
import { applyTheme, savedTheme } from "#client/applyTheme.ts";
import "#client/main.css";

Effect.runSync(
	Effect.gen(function* () {
		applyTheme(savedTheme());

		const container = document.getElementById("root");
		if (container === null) {
			return yield* Effect.die(new Error("Missing application root"));
		}
		const auth = makeAuth({ baseUrl: window.location.origin });
		createRoot(container).render(
			<RegistryProvider>
				<App auth={auth} />
			</RegistryProvider>,
		);
	}),
);

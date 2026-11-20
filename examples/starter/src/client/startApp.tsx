import { RegistryProvider } from "@effect/atom-react";
import { createRoot } from "react-dom/client";
import { browserQueryStorage } from "@shivaedev/contract/adapters/browserQueryStorage.ts";
import { App } from "#client/App.tsx";
import type { Auth } from "#client/adapters/auth.ts";
import { applyTheme, savedTheme } from "#client/applyTheme.ts";

export function startApp(container: Element, auth: Auth) {
	applyTheme(savedTheme());
	const root = createRoot(container);
	root.render(
		<RegistryProvider>
			<App auth={auth} persist={browserQueryStorage} />
		</RegistryProvider>,
	);
	return root;
}

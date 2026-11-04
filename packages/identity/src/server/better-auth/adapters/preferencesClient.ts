import type { BetterAuthClientPlugin } from "better-auth/client";

export function preferencesClient(): Pick<BetterAuthClientPlugin, "id" | "fetchPlugins"> {
	return {
		fetchPlugins: [
			{
				hooks: {
					onRequest(context) {
						if (!("window" in globalThis)) {
							return context;
						}
						const { locale, timeZone } = new Intl.DateTimeFormat().resolvedOptions();
						const headers = new Headers(context.headers);
						headers.set("x-platform-account-timezone", timeZone);
						headers.set("x-platform-account-locale", locale);
						return { ...context, headers };
					},
				},
				id: "identity-account-preferences",
				name: "identity-account-preferences",
			},
		],
		id: "identity-account-preferences",
	};
}

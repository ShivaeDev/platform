import type { BetterAuthClientPlugin } from "better-auth/client";

export function preferencesClient() {
	return {
		fetchPlugins: [
			{
				hooks: {
					onRequest(context) {
						if (typeof window === "undefined") {
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
	} satisfies BetterAuthClientPlugin;
}

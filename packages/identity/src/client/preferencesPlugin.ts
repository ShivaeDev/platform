import { accountPreferenceHeaders } from "#accountPreferenceHeaders.ts";

// Structural copies of the Better Auth client plugin shapes: the client core must not reach the optional better-auth peer.
interface PreferenceRequest {
	readonly headers: Headers;
}

interface PreferenceFetchPlugin {
	readonly hooks: { readonly onRequest: (context: PreferenceRequest) => void };
	readonly id: string;
	readonly name: string;
}

export interface PreferencesPlugin {
	readonly fetchPlugins: PreferenceFetchPlugin[];
	readonly id: "identity-account-preferences";
}

export function preferencesPlugin(): PreferencesPlugin {
	return {
		fetchPlugins: [
			{
				hooks: {
					onRequest(context) {
						// A server-rendered auth call would send the server's zone, so only a page or app shell sends one.
						if (!("window" in globalThis)) {
							return;
						}
						const { locale, timeZone } = new Intl.DateTimeFormat().resolvedOptions();
						context.headers.set(accountPreferenceHeaders.timezone, timeZone);
						context.headers.set(accountPreferenceHeaders.locale, locale);
					},
				},
				id: "identity-account-preferences",
				name: "identity-account-preferences",
			},
		],
		id: "identity-account-preferences",
	};
}

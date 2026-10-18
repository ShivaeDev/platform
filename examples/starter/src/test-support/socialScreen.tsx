import { createAuthClient } from "better-auth/react";
import { act } from "react";
import { createRoot } from "react-dom/client";

export async function socialScreen(baseUrl: string, fetch: typeof globalThis.fetch) {
	const client = createAuthClient({ "baseURL": baseUrl, fetchOptions: { customFetchImpl: fetch } });
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	let pending = false;
	let failure: unknown;
	await act(async () =>
		root.render(
			<button
				onClick={() => {
					pending = true;
					void client.signIn.social({ "callbackURL": `${baseUrl}/signed-in`, provider: "github" }).then(
						(result) => {
							failure = result.error ?? undefined;
							pending = false;
						},
						(error: unknown) => {
							failure = error;
							pending = false;
						},
					);
				}}
				type="button"
			>
				Sign in with GitHub
			</button>,
		),
	);
	return {
		async close() {
			await act(async () => root.unmount());
			container.remove();
		},
		pending() {
			if (failure !== undefined) {
				throw new Error(`Social sign-in failed: ${JSON.stringify(failure)}`);
			}
			return pending;
		},
	};
}

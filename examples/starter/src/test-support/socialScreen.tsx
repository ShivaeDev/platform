import { createAuthClient } from "better-auth/react";
import { act } from "react";
import { createRoot } from "react-dom/client";

export async function socialScreen(baseUrl: string, fetch: typeof globalThis.fetch) {
	const client = createAuthClient({ "baseURL": baseUrl, fetchOptions: { customFetchImpl: fetch } });
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	let pending: ReturnType<typeof client.signIn.social> | undefined;
	await act(async () =>
		root.render(
			<button
				onClick={() => {
					pending = client.signIn.social({ "callbackURL": `${baseUrl}/signed-in`, provider: "github" });
				}}
				type="button"
			>
				Sign in with GitHub
			</button>,
		),
	);
	return {
		async click() {
			await act(async () => {
				const button = container.querySelector("button");
				if (button === null) {
					throw new Error("Missing GitHub sign-in button");
				}
				button.click();
				const result = await pending;
				if (result?.error !== null) {
					throw new Error(`Social sign-in failed: ${JSON.stringify(result)}`);
				}
			});
		},
		async close() {
			await act(async () => root.unmount());
			container.remove();
		},
	};
}

export function heldSignIn(fetch: typeof globalThis.fetch) {
	let release: (() => void) | undefined;
	let gate: Promise<void> | undefined;
	return {
		fetch: async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
			const request = new Request(input, init);
			const response = await fetch(request);
			if (new URL(request.url).pathname === "/api/auth/sign-in/email") {
				await gate;
			}
			return response;
		},
		hold: () => {
			gate = new Promise((resolve) => {
				release = resolve;
			});
		},
		release: () => {
			if (release === undefined) {
				throw new Error("No sign-in response is held");
			}
			release();
			release = undefined;
			gate = undefined;
		},
	};
}

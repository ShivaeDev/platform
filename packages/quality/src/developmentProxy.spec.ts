import { expect } from "vitest";
import { development } from "#test/development.ts";

for (const path of ["/health?probe=dev", "/api/auth/session", "/rpc"]) {
	development.it(
		`Vite forwards ${path} to the application host with its path and the Host header the browser sent to Vite`,
		[],
		function* ({ hostReceived, requests, viteHost }) {
			yield* requests(path);

			expect(yield* hostReceived()).toEqual({ host: yield* viteHost(), path });
		},
	);
}

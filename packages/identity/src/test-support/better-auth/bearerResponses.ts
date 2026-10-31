import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { emptyMount, startMountHost } from "./mountHost.ts";

export const bearerResponses = storyKit({
	after: { configured: startMountHost },
	clock: "live",
	create: () => ({ ...emptyMount(), bearerSessions: { origins: ["capacitor://localhost"] } }),
	name: "browser responses behind bearer sessions",
	stages: ["configured"],
	verbs: (engine, story) => ({
		request: () =>
			Effect.promise(async () => {
				story.tell("the browser requests the provider's response through the bearer-enabled mount");
				const response = await fetch(`${engine.urls[0]}/api/auth/visitor`, { redirect: "manual" });
				return {
					body: await response.text(),
					contentType: response.headers.get("content-type"),
					cookie: response.headers.get("set-cookie"),
					location: response.headers.get("location"),
					status: response.status,
				};
			}),
	}),
});

export function providerResponds(body: string | null, contentType: string, status: number) {
	return bearerResponses.trait("configured", `the provider sends HTTP ${status} with ${contentType} and body ${JSON.stringify(body)}`, (engine) => {
		engine.reply = new Response(body, {
			headers: { "content-type": contentType, "location": "/callback", "set-cookie": "application-cookie=value; HttpOnly" },
			status,
		});
	});
}

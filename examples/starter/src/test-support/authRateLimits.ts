import { request } from "node:http";
import { Effect } from "effect";
import { credentials } from "./authHttp.ts";
import type { RunningHost } from "./host.ts";

export function authRateLimits(host: RunningHost, tell: (line: string) => void) {
	return {
		visitor: (clientIp: string) => {
			tell(`a visitor connects from ${clientIp}`);
			return {
				signIn: Effect.fn("StarterStory.signIn")(function* (forwardedFor?: string, realIp?: string) {
					tell(`the visitor at ${clientIp} attempts sign-in with ${JSON.stringify({ forwardedFor, realIp })}`);
					return yield* Effect.promise(() => signInStatus(host, clientIp, forwardedFor, realIp));
				}),
			};
		},
	};
}

function signInStatus(host: RunningHost, clientIp: string, forwardedFor?: string, realIp?: string) {
	const url = new URL("/api/auth/sign-in/email", host.baseUrl);
	url.hostname = clientIp.includes(":") ? "[::1]" : "127.0.0.1";
	return new Promise<number>((resolve, reject) => {
		const outgoing = request(
			url,
			{
				headers: {
					"content-type": "application/json",
					origin: host.origin,
					...(forwardedFor === undefined ? {} : { "x-forwarded-for": forwardedFor }),
					...(realIp === undefined ? {} : { "x-real-ip": realIp }),
				},
				localAddress: clientIp,
				method: "POST",
			},
			(response) => {
				response.on("error", reject);
				response.on("end", () => resolve(response.statusCode ?? 500));
				response.resume();
			},
		);
		outgoing.on("error", reject);
		outgoing.end(JSON.stringify(credentials("unknown")));
	});
}

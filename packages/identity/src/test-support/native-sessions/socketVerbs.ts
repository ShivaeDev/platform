import { Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { answerOf } from "@shivaedev/test/answers.ts";
import type { Host } from "./host.ts";
import { type Account, authRequest } from "./requests.ts";
import { openProfile, type ProfileSocket, rejectedFrame } from "./socketClient.ts";

export function socketVerbs(host: Host, account: (name: string) => Account, tell: (line: string) => void) {
	const sockets = new Map<string, ProfileSocket>();
	function socket(name: string) {
		const value = sockets.get(name);
		if (value === undefined) {
			throw new Error(`${name} has not opened a profile`);
		}
		return value;
	}
	return {
		announceProfiles: () => {
			tell("the host announces current profile values to its live clients");
			return Effect.promise(async () => {
				await (await fetch(`${host.baseUrl}/resync`, { method: "POST" })).text();
			});
		},
		changeProfile: (name: string, value: string) => {
			tell(`${name} changes their profile name to ${value} through the auth route without announcing it`);
			return Effect.gen(function* () {
				const response = yield* authRequest(host, "update-user", { authorization: `Bearer ${account(name).credential}` }, { name: value });
				if (!response.ok) {
					return yield* Effect.die(`Profile change answered ${response.status}`);
				}
				yield* Effect.promise(() => response.text());
			});
		},
		openNativeProfile: (name: string, owner = name) => {
			tell(`${name} opens ${owner}'s live profile with a browser WebSocket constructor and a first-frame bearer`);
			return Effect.gen(function* () {
				sockets.set(name, yield* openProfile(host, account(name), account(owner)));
			});
		},
		openRestrictedProfile: (name: string, owner: string) => {
			tell(`${name} opens ${owner}'s profile through an owner-only query read policy`);
			return Effect.gen(function* () {
				sockets.set(name, yield* openProfile(host, account(name), account(owner), true));
			});
		},
		profileShown: (name: string, expected?: string) => {
			const next = socket(name).next.pipe(
				Stream.filter((result) => expected === undefined || (AsyncResult.isSuccess(result) && result.value.name === expected)),
				Stream.runHead,
			);
			return Effect.map(next, (result) => {
				if (Option.isNone(result)) {
					return "no profile received";
				}
				return answerOf(AsyncResult.toExit(result.value));
			});
		},
		rejectNativeCredential: (name: string, kind: "invalid" | "expired" | "malformed" | "oversized" | "header-control") => {
			tell(`a native socket sends a ${kind} authentication frame`);
			let token = kind === "invalid" ? "invalid.signature" : account(name).credential;
			if (kind === "header-control") {
				token = "invalid\r\ncredential";
			}
			let frame = JSON.stringify({ _tag: "Authenticate", token });
			if (kind === "malformed") {
				frame = "not JSON";
			}
			if (kind === "oversized") {
				frame = "x".repeat(8193);
			}
			return rejectedFrame(host, frame);
		},
		resumeNative: (name: string) => {
			tell(`${name}'s native shell resumes`);
			return socket(name).resume;
		},
		silentNativeSocket: () => {
			tell("a native socket opens without sending its authentication frame");
			return rejectedFrame(host);
		},
		socketClosed: (name: string) => socket(name).closed,
		socketUrls: (name: string) => Effect.sync(() => socket(name).urls.map((url) => url.replace(host.baseUrl.replace(/^http/u, "ws"), ""))),
	};
}

import { expect } from "vitest";
import { ANDROID_ORIGIN, NATIVE_ORIGIN } from "#test/native-sessions/host.ts";
import { forwardedNative, origins, proxyTrust, withoutNativeOrigins } from "#test/native-sessions/originStory.ts";

for (const origin of [NATIVE_ORIGIN, ANDROID_ORIGIN]) {
	origins.it(`admits ${origin} with a signed bearer through RPC and auth`, [], function* ({ mintSession, profile, request }) {
		const session = yield* mintSession();
		const headers = { authorization: `Bearer ${session.credential}`, origin };
		const rpc = yield* profile(session.user.id, headers);
		expect(rpc.status).toBe(200);
		expect(rpc.body).toContain(session.user.email);
		expect(rpc.headers.get("access-control-allow-origin")).toBe(origin);
		expect(rpc.headers.get("vary")).toContain("Origin");
		expect(rpc.headers.get("access-control-allow-credentials")).toBeNull();
		const auth = yield* request("/api/auth/get-session", { headers });
		expect(JSON.parse(auth.body)).toMatchObject({ user: { id: session.user.id } });
		expect(auth.headers.get("access-control-allow-origin")).toBe(origin);
		expect(auth.headers.get("access-control-expose-headers")).toBe("set-auth-token");
		expect(auth.headers.get("access-control-allow-credentials")).toBeNull();
	});
}

origins.it("refuses all other origins before session authorization", [], function* ({ mintSession, profile, lookups, request }) {
	const session = yield* mintSession();
	const before = lookups();
	for (const origin of ["https://attacker.example", "capacitor://localhost.evil", "https://localhost:444", "null"]) {
		const headers = { authorization: `Bearer ${session.credential}`, origin };
		const rpc = yield* profile(session.user.id, headers);
		expect(rpc).toMatchObject({ body: "Local same-origin requests only", status: 403 });
		expect(rpc.headers.get("access-control-allow-origin")).toBeNull();
		const auth = yield* request("/api/auth/get-session", { headers });
		expect(auth.status).toBe(403);
		expect(auth.headers.get("access-control-allow-origin")).toBeNull();
	}
	expect(lookups()).toBe(before);
});

origins.it("answers only configured native preflights with the route's methods and headers", [], function* ({ preflight, lookups }) {
	for (const path of ["/rpc", "/api/auth/sign-in/email"]) {
		for (const origin of [NATIVE_ORIGIN, ANDROID_ORIGIN]) {
			const response = yield* preflight(path, origin);
			expect(response.status).toBe(204);
			expect(response.headers.get("access-control-allow-origin")).toBe(origin);
			expect(response.headers.get("vary")).toContain("Origin");
			expect(response.headers.get("access-control-allow-methods")).toBe(path === "/rpc" ? "POST" : "GET, POST");
			expect(response.headers.get("access-control-allow-headers")).toBe("Authorization,Content-Type");
			expect(response.headers.get("access-control-allow-credentials")).toBeNull();
		}
		const refused = yield* preflight(path, "https://attacker.example");
		expect(refused.status).toBe(403);
		expect(refused.headers.get("access-control-allow-origin")).toBeNull();
	}
	expect(lookups()).toBe(0);
});

origins.it(
	"keeps browser cookies same-origin and ignores them on native auth and RPC",
	[],
	function* ({ mintSession, profile, request, sameOrigin }) {
		const session = yield* mintSession();
		const browser = yield* profile(session.user.id, { cookie: session.cookie, origin: sameOrigin() });
		expect(browser.body).toContain(session.user.email);
		expect(browser.headers.get("access-control-allow-origin")).toBeNull();
		const native = { cookie: session.cookie, origin: NATIVE_ORIGIN };
		expect((yield* profile(session.user.id, native)).body).toContain('"_tag":"Unauthorized"');
		expect((yield* request("/api/auth/get-session", { headers: native })).body).toBe("null");
		const bearer = { ...native, authorization: `Bearer ${session.credential}` };
		expect((yield* profile(session.user.id, bearer)).body).toContain(session.user.email);
		expect(JSON.parse((yield* request("/api/auth/get-session", { headers: bearer })).body)).toMatchObject({ user: { id: session.user.id } });
	},
);

origins.it("keeps native RPC closed without host opt-in", [withoutNativeOrigins], function* ({ mintSession, profile, preflight, lookups }) {
	const session = yield* mintSession();
	expect((yield* profile(session.user.id, { authorization: `Bearer ${session.credential}`, origin: NATIVE_ORIGIN })).status).toBe(403);
	expect((yield* preflight("/rpc", NATIVE_ORIGIN)).headers.get("access-control-allow-origin")).toBeNull();
	expect(lookups()).toBe(0);
});

for (const [peer, status] of [
	["127.0.0.1", 200],
	["127.0.0.2", 403],
] as const) {
	origins.it(
		`validates the forwarded native peer against ${peer}`,
		[proxyTrust(peer), forwardedNative()],
		function* ({ mintSession, profile, lookups }) {
			const session = yield* mintSession();
			const result = yield* profile(session.user.id, { authorization: `Bearer ${session.credential}`, origin: NATIVE_ORIGIN });
			expect(result.status).toBe(status);
			if (status === 200) {
				expect(result.body).toContain(session.user.email);
			} else {
				expect(lookups()).toBe(0);
			}
		},
	);
}

for (const [authority, protocol] of [
	["app.example, evil.example", "https"],
	["app.example", "https, http"],
]) {
	origins.it(
		`rejects native forwarding with ${authority} and ${protocol}`,
		[proxyTrust("127.0.0.1"), forwardedNative(authority, protocol)],
		function* ({ profile, lookups }) {
			expect((yield* profile("unknown", { origin: NATIVE_ORIGIN })).status).toBe(403);
			expect(lookups()).toBe(0);
		},
	);
}

origins.it("rejects message-supplied credentials and still enforces NDJSON", [], function* ({ mintSession, profile, lookups }) {
	const session = yield* mintSession();
	expect(lookups()).toBe(0);
	const forged = yield* profile(session.user.id, { origin: NATIVE_ORIGIN }, [
		["authorization", `Bearer ${session.credential}`],
		["cookie", session.cookie],
	]);
	expect(forged.body).toContain('"_tag":"Unauthorized"');
	const wrongOrigin = yield* profile(session.user.id, { origin: "https://attacker.example" }, [["origin", NATIVE_ORIGIN]]);
	expect(wrongOrigin.status).toBe(403);
	const wrongType = yield* profile(session.user.id, { "content-type": "text/plain", origin: NATIVE_ORIGIN });
	expect(wrongType.status).toBe(403);
});

origins.it("delivers incremental native NDJSON updates and releases server work when fetch aborts", [], function* ({ mintSession, stream }) {
	const session = yield* mintSession();
	const subscription = yield* stream(NATIVE_ORIGIN, session.credential);
	for (let update = 0; update < 3; update += 1) {
		expect(yield* subscription.next).toMatchObject({ _tag: "Resync" });
		expect(yield* subscription.resync).toBe([subscription].length);
	}
	yield* subscription.abort;
	expect(yield* subscription.awaitReleased).toBe(0);
});

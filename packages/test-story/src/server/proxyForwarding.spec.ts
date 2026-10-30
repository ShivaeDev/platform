import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { attempt } from "#test/attempt.ts";
import { proxyHost } from "#test/proxyHost.ts";

const NOTE = {
	body: "a note sent through the proxy",
	headers: { "content-type": "text/plain", "x-forwarded-host": "forged.example", "x-forwarded-proto": "http", "x-story": "retained" },
	method: "POST",
};

const PUBLIC_HEADERS = {
	headers: {
		host: "private.internal",
		"x-forwarded-host": "public.example:8443",
		"x-forwarded-proto": "https",
		"x-real-ip": "203.0.113.9",
	},
};

proxyHost.it("forwards the request's method, path and body to the host", [], function* ({ hostSaw, sends, startsProxy }) {
	yield* startsProxy();

	yield* sends("/notes?source=story", NOTE);

	expect(yield* hostSaw()).toMatchObject({ body: "a note sent through the proxy", method: "POST", path: "/notes?source=story" });
});

proxyHost.it("sends the story's headers over the client's and keeps the client's other headers", [], function* ({ hostSaw, sends, startsProxy }) {
	yield* startsProxy(PUBLIC_HEADERS);

	yield* sends("/notes?source=story", NOTE);

	expect((yield* hostSaw()).headers).toMatchObject({
		"content-type": "text/plain",
		host: "private.internal",
		"x-forwarded-for": "127.0.0.1",
		"x-forwarded-host": "public.example:8443",
		"x-forwarded-proto": "https",
		"x-real-ip": "203.0.113.9",
		"x-story": "retained",
	});
});

proxyHost.it("returns the host's status, headers and every cookie to the client", [], function* ({ answer, cookies, header, sends, startsProxy }) {
	yield* startsProxy();

	yield* sends("/notes?source=story", NOTE);

	yield* outcomes({
		answer: [answer(), "HTTP 201 with a body"],
		cookies: [cookies(), ["first=one", "second=two"]],
		"x-host header": [header("x-host"), "reached"],
	});
});

for (const [hostname, peer] of [
	["127.0.0.1", "127.0.0.1"],
	["[::1]", "::1"],
]) {
	proxyHost.it(`appends the ${peer} caller to an existing forwarding chain`, [], function* ({ forwardedFor, sends, startsProxy }) {
		yield* startsProxy();

		yield* sends("/echo", { headers: { "x-forwarded-for": "198.51.100.10, 192.0.2.1" } }, hostname);

		expect(yield* forwardedFor()).toBe(`198.51.100.10, 192.0.2.1, ${peer}`);
	});
}

proxyHost.it("appends the story's visitor and edge after the client's forwarding chain", [], function* ({ forwardedFor, sends, startsProxy }) {
	yield* startsProxy({ forwardedHops: ["visitor", "edge"] });

	yield* sends("/echo", { headers: { "x-forwarded-for": "spoofed" } });

	expect(yield* forwardedFor()).toBe("spoofed, visitor, edge");
});

proxyHost.it("lets the story's forwarded-for header replace the whole chain", [], function* ({ forwardedFor, sends, startsProxy }) {
	yield* startsProxy({ forwardedHops: ["visitor", "edge"], headers: { "x-forwarded-for": "203.0.113.42" } });

	yield* sends("/echo", { headers: { "x-forwarded-for": "198.51.100.10" } });

	expect(yield* forwardedFor()).toBe("203.0.113.42");
});

for (const localAddress of ["127.0.0.1", "::1"]) {
	proxyHost.it(`connects to the host from the local address ${localAddress}`, [], function* ({ hostSawCallerAt, sends, startsProxy }) {
		yield* startsProxy({ localAddress });

		yield* sends("/echo");

		expect(yield* hostSawCallerAt()).toBe(localAddress);
	});
}

proxyHost.it("refuses to start on a local address the machine does not have", [], function* ({ startsProxy }) {
	expect(yield* attempt(startsProxy({ localAddress: "192.0.2.123" }))).toBe(
		"failed with Cannot acquire forwarding proxy with local address 192.0.2.123",
	);
});

proxyHost.it("answers with a bad gateway once the host stops listening", [], function* ({ answer, sends, startsProxy, stopsHost }) {
	yield* startsProxy();
	yield* stopsHost();

	yield* sends("/echo");

	expect(yield* answer()).toBe("HTTP 502");
});

for (const hostname of ["127.0.0.1", "[::1]"]) {
	proxyHost.it(`stops listening on ${hostname} once the proxy's scope closes`, [], function* ({ closesProxy, reaches, startsProxy }) {
		yield* startsProxy();
		expect(yield* reaches(hostname)).toBe("HTTP 201");

		yield* closesProxy();

		expect(yield* reaches(hostname)).toBe("connection refused");
	});
}

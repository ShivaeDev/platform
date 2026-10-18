import { expect } from "vitest";
import { proxyHost } from "#test/proxyHost.ts";

proxyHost.it("forwards a request to the host with the story's headers and returns its response", [], function* ({ startProxy, request }) {
	yield* startProxy({
		host: "private.internal",
		"x-forwarded-host": "public.example:8443",
		"x-forwarded-proto": "https",
		"x-real-ip": "203.0.113.9",
	});
	const response = yield* request("/notes?source=story", {
		body: "a note sent through the proxy",
		headers: { "content-type": "text/plain", "x-forwarded-host": "forged.example", "x-forwarded-proto": "http", "x-story": "retained" },
		method: "POST",
	});
	expect(response).toMatchObject({ cookies: ["first=one", "second=two"], headers: { "x-host": "reached" }, status: 201 });
	expect(JSON.parse(response.body)).toMatchObject({
		body: "a note sent through the proxy",
		headers: {
			"content-type": "text/plain",
			host: "private.internal",
			"x-forwarded-for": "127.0.0.1",
			"x-forwarded-host": "public.example:8443",
			"x-forwarded-proto": "https",
			"x-real-ip": "203.0.113.9",
			"x-story": "retained",
		},
		method: "POST",
		path: "/notes?source=story",
	});
});

for (const [hostname, peer] of [
	["127.0.0.1", "127.0.0.1"],
	["[::1]", "::1"],
]) {
	proxyHost.it(`appends the ${peer} caller to an existing forwarding chain`, [], function* ({ startProxy, request }) {
		yield* startProxy();
		const response = yield* request("/echo", { headers: { "x-forwarded-for": "198.51.100.10, 192.0.2.1" } }, hostname);
		expect(JSON.parse(response.body)).toMatchObject({ headers: { "x-forwarded-for": `198.51.100.10, 192.0.2.1, ${peer}` } });
	});
}

proxyHost.it("lets a story set the entire forwarded-for header", [], function* ({ startProxy, request }) {
	yield* startProxy({ "x-forwarded-for": "203.0.113.42" });
	const response = yield* request("/echo", { headers: { "x-forwarded-for": "198.51.100.10" } });
	expect(JSON.parse(response.body)).toMatchObject({ headers: { "x-forwarded-for": "203.0.113.42" } });
});

proxyHost.it("answers with a bad gateway when the host stops listening", [], function* ({ startProxy, stopHost, request }) {
	yield* startProxy();
	yield* stopHost();
	expect(yield* request("/echo")).toMatchObject({ body: "", status: 502 });
});

proxyHost.it("closes both loopback listeners when the story scope ends", [], function* ({ startProxy, request }, context) {
	const url = yield* startProxy();
	expect(yield* request("/echo")).toMatchObject({ status: 201 });
	context.onTestFinished(async () => {
		await expect(fetch(`${url}/echo`)).rejects.toThrow();
		const ipv6 = new URL("/echo", url);
		ipv6.hostname = "[::1]";
		await expect(fetch(ipv6)).rejects.toThrow();
	});
});

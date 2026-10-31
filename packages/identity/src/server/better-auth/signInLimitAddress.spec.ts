import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { clientIp, noProxy, proxyEnvironment } from "#test/better-auth/clientIp.ts";

for (const { address, headers, name, peer, source, traits } of [
	{
		address: "203.0.113.20",
		headers: { "x-forwarded-for": "198.51.100.99, 203.0.113.20, 127.0.0.1" },
		name: "a trusted proxy's forwarded chain",
		peer: "127.0.0.1",
		source: "forwarded",
		traits: [],
	},
	{
		address: "203.0.113.10",
		headers: { "x-forwarded-for": "198.51.100.99", "x-real-ip": "203.0.113.10" },
		name: "a trusted proxy's configured X-Real-IP header",
		peer: "127.0.0.1",
		source: "forwarded",
		traits: [proxyEnvironment({ "AUTH_CLIENT_IP_HEADER": "x-real-ip" })],
	},
	{
		address: "127.0.0.1",
		headers: { "x-forwarded-for": "198.51.100.99", "x-platform-client-ip": "203.0.113.10" },
		name: "a direct peer despite forged address headers",
		peer: "127.0.0.1",
		source: "peer",
		traits: [noProxy],
	},
	{
		address: "127.0.0.2",
		headers: {},
		name: "a trusted peer without a forwarded header",
		peer: "127.0.0.2",
		source: "peer",
		traits: [proxyEnvironment({ "TRUSTED_PROXY": "127.0.0.0/8" })],
	},
	{
		address: "2001:0db8:abcd:0012:0000:0000:0000:0000",
		headers: { "x-forwarded-for": "2001:db8:abcd:12::1234" },
		name: "a trusted proxy's normalized IPv6 subnet",
		peer: "127.0.0.1",
		source: "forwarded",
		traits: [],
	},
]) {
	clientIp.it(`counted and refused sign-ins record the address and source from ${name}`, traits, function* ({ recordedSignInLimits, signIn }) {
		yield* signIn(headers, peer);
		yield* signIn(headers, peer);
		yield* signIn(headers, peer);

		expect(yield* recordedSignInLimits()).toEqual([
			{ address, source, status: HttpStatus.fromLiteral("Unauthorized") },
			{ address, source, status: HttpStatus.fromLiteral("Unauthorized") },
			{ address, source, status: HttpStatus.fromLiteral("TooManyRequests") },
		]);
	});
}

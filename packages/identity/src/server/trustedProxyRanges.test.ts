import { expect } from "vitest";
import { transport, trustedProxy } from "#test/rpc/transportStory.ts";

for (const [reason, trust, ranges] of [
	["no proxy trust", undefined, []],
	["an empty proxy trust", "", []],
	["a list with an invalid entry", "127.0.0.1,invalid", []],
	["an IPv6 prefix longer than 128 bits", "::ffff:127.0.0.0/129", []],
	["one IPv4-mapped address", "::ffff:127.0.0.1", ["127.0.0.1"]],
	["one IPv4-mapped address with a full prefix", "::ffff:192.0.2.1/128", ["192.0.2.1/32"]],
	["an IPv4-mapped range", "::ffff:127.0.0.0/104", ["127.0.0.0/8"]],
	["an IPv4-mapped range in hex", "::ffff:7f00:0/104", ["127.0.0.0/8"]],
	["an IPv4-mapped range spelled out in uppercase", "0:0:0:0:0:FFFF:7F00:0/104", ["127.0.0.0/8"]],
	["the whole IPv4-mapped space", "::ffff:0.0.0.0/96", ["0.0.0.0/0"]],
	["a mapped range one bit wider than IPv4", "::ffff:127.0.0.0/95", ["::fffe:0:0/95", "0.0.0.0/0"]],
	["a mapped range eight bits wider than IPv4", "::ffff:127.0.0.0/88", ["::ff00:0:0/88", "0.0.0.0/0"]],
	["a mapped range sixteen bits wider than IPv4", "::ffff:127.0.0.0/80", ["::/80", "0.0.0.0/0"]],
	["a mapped range covering everything", "::ffff:127.0.0.0/0", ["::/0", "0.0.0.0/0"]],
	["an IPv6 range that contains the mapped space", "::/64", ["::/64", "0.0.0.0/0"]],
	["an IPv6 /95 range that contains the mapped space", "::fffe:0:0/95", ["::fffe:0:0/95", "0.0.0.0/0"]],
	["a padded list of an IPv6 and an IPv4 range", " 2001:db8::/32, 127.0.0.0/8 ", ["2001:db8::/32", "127.0.0.0/8"]],
] as const) {
	transport.it(`${reason} normalizes to ${JSON.stringify(ranges)}`, [trustedProxy(trust)], function* ({ normalizedTrust }) {
		expect(yield* normalizedTrust()).toEqual(ranges);
	});
}

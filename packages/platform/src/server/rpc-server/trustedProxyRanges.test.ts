import { expect } from "vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { transportOptions, trustedProxy } from "#test/rpc/transportStory.ts";

const transport = storyKit(transportOptions);

for (const [value, ranges] of [
	[undefined, []],
	["", []],
	["127.0.0.1,invalid", []],
	["::ffff:127.0.0.0/129", []],
	["::ffff:127.0.0.1", ["127.0.0.1"]],
	["::ffff:192.0.2.1/128", ["192.0.2.1/32"]],
	["::ffff:127.0.0.0/104", ["127.0.0.0/8"]],
	["::ffff:7f00:0/104", ["127.0.0.0/8"]],
	["0:0:0:0:0:FFFF:7F00:0/104", ["127.0.0.0/8"]],
	["::ffff:0.0.0.0/96", ["0.0.0.0/0"]],
	["::ffff:127.0.0.0/95", ["::fffe:0:0/95", "0.0.0.0/0"]],
	["::ffff:127.0.0.0/88", ["::ff00:0:0/88", "0.0.0.0/0"]],
	["::ffff:127.0.0.0/80", ["::/80", "0.0.0.0/0"]],
	["::ffff:127.0.0.0/0", ["::/0", "0.0.0.0/0"]],
	["::/64", ["::/64", "0.0.0.0/0"]],
	["::fffe:0:0/95", ["::fffe:0:0/95", "0.0.0.0/0"]],
	[" 2001:db8::/32, 127.0.0.0/8 ", ["2001:db8::/32", "127.0.0.0/8"]],
] as const) {
	transport.it(`normalizes host proxy trust ${value} to equivalent address families`, [trustedProxy(value)], function* ({ normalizeTrust }) {
		expect(yield* normalizeTrust()).toEqual(ranges);
	});
}

import { expect } from "vitest";
import { storySpecs } from "@shivaedev/quality/rules/stories/specs.ts";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";
import { ordersPackage, pureOrders, unitSpec } from "#quality/test-support/unitFiles.ts";

for (const [name, imports, expected] of [
	["address parsing and ranges", 'import { BlockList, isIP as family, type Socket } from "node:net";', 0],
	["a socket alongside address parsing", 'import { BlockList, createServer } from "node:net";', 1],
	["a default network import", 'import net from "node:net";', 1],
	["a dynamic network import", 'const net = import("node:net");', 1],
	["a network namespace", 'import * as net from "node:net";', 1],
] as const) {
	ruleKit.it(
		`a unit test importing ${name} has ${expected} engine findings`,
		[repositoryHas(ordersPackage, pureOrders, unitSpec(`${imports}\nit("runs", () => {});`))],
		function* ({ check }) {
			const findings = yield* check(storySpecs);
			if (expected === 0) {
				expect(findings).toEqual([]);
			} else {
				expect(findings).toEqual([expect.objectContaining({ message: expect.stringContaining("reaches the network (node:net)") })]);
			}
		},
	);
}

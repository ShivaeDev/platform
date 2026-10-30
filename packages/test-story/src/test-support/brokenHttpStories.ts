import { brokenHttpApp, handlerThrows } from "./brokenHttpApp.ts";

for (const [kind, thrown] of [
	["error", new Error("reply crashed")],
	["string", "reply refused"],
	["object", { _tag: "BrokenReply", reason: "missing fixture" }],
] as const) {
	brokenHttpApp.it(`handles a reply that throws ${kind}`, [handlerThrows("reply", thrown)], function* ({ request }) {
		yield* request();
	});
}

for (const source of ["guard", "script", "stream"] as const) {
	brokenHttpApp.it(`handles a ${source} that throws`, [handlerThrows(source, { _tag: "BrokenHandler", source })], function* ({ request }) {
		yield* request();
	});
}

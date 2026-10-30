import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { nativeStackDiagnostics, publicStackDiagnostics } from "#test/app-host/nativeStackDiagnostics.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

const kept = { publicReasonNote: "public reason detail" };

for (const protocol of ["http/json", "http/protobuf"]) {
	host.it(
		`when stacks are public, a ten-frame native stack chain reaches the reported cause and the ${protocol} export`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), publicStackDiagnostics],
		function* ({ callRpc, close, exportMentions, reportMentions }) {
			yield* callRpc("nativeStack", { depth: 10, kind: "interruption", marker: "public-frame" });

			yield* close();

			yield* outcomes({
				"exported frames": [exportMentions("public-frame-9", "public-frame-2"), ["public-frame-9", "public-frame-2"]],
				"reported frames": [reportMentions("public-frame-9", "public-frame-2"), ["public-frame-9", "public-frame-2"]],
			});
		},
	);
}

for (const [kind, reasons] of [
	["defect", [{ annotations: kept, reason: "defect" }]],
	[
		"interruption",
		[
			{ annotations: kept, reason: "defect" },
			{ annotations: kept, reason: "interruption by fiber 123" },
		],
	],
] as const) {
	host.it(
		`a sensitive stack drops the native stack annotations from a reported ${kind} but keeps its reasons and public notes`,
		[nativeStackDiagnostics],
		function* ({ callRpc, reportedReasons }) {
			yield* callRpc("nativeStack", { fiberId: 123, kind, marker: "private-native-stack-marker" });

			expect(yield* reportedReasons()).toEqual(reasons);
		},
	);
	for (const protocol of ["http/json", "http/protobuf"]) {
		host.it(
			`a sensitive stack keeps the ${protocol} exception event of a ${kind} without its native frames`,
			[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), nativeStackDiagnostics],
			function* ({ callRpc, close, exceptionStack, exportMentions }) {
				yield* callRpc("nativeStack", { fiberId: 123, kind, marker: "private-native-stack-marker" });

				yield* close();

				yield* outcomes({
					"exception stack": [exceptionStack("nativeStack"), expect.stringContaining("public defect")],
					"leaked frames": [exportMentions("private-native-stack-marker"), []],
				});
			},
		);
	}
}

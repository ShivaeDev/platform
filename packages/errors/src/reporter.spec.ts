import { expect } from "vitest";
import { errors } from "#test/errors.ts";

for (const kind of ["failure", "defect"] as const) {
	errors.it(`the reporter receives a ${kind} with masked fields and request annotations`, [], function* ({ recordedReports, reportFault }) {
		const fault = Object.assign(new Error("connect with password=hunter2-plaintext failed"), { apiKey: "key-plaintext", status: 503 });

		yield* reportFault(kind, fault);

		const reports = yield* recordedReports();
		expect(reports).toMatchObject([
			{
				requestDetails: [{ password: "<redacted>" }],
				[kind === "failure" ? "failures" : "defects"]: [{ apiKey: "<redacted>", message: "connect with password=<redacted> failed", status: 503 }],
			},
		]);
		expect(reports[0]?.text).not.toMatch(/plaintext/u);
	});
}

errors.it(
	"the reporter receives a defect whose message quotes escaped JSON with its access token masked",
	[],
	function* ({ recordedReports, reportFault }) {
		const fault = new Error(String.raw`upstream answered {"error":"{\"access_token\":\"token-plaintext\",\"detail\":\"expired\"}"}`);

		yield* reportFault("defect", fault);

		expect(yield* recordedReports()).toMatchObject([
			{ defects: [{ message: String.raw`upstream answered {"error":"{\"access_token\":\"<redacted>\",\"detail\":\"expired\"}"}` }] },
		]);
	},
);

import { ErrorReporter } from "effect";
import { expect } from "vitest";
import { errors } from "#test/errors.ts";

for (const kind of ["failure", "defect"] as const) {
	errors.it(`the reporter receives a ${kind} with masked fields and request annotations`, [], function* ({ recordedReports, reportFault }) {
		const fault = {
			[ErrorReporter.attributes]: { requestId: "request-1" },
			apiKey: "key-plaintext",
			message: "connect with password=hunter2-plaintext failed",
			stack: "Error: connect with password=hunter2-plaintext failed\n    at request",
			status: 503,
		};

		yield* reportFault(kind, fault);

		const reports = yield* recordedReports();
		const reported = reports[0]?.[kind === "failure" ? "failures" : "defects"]?.[0];
		expect(reports).toMatchObject([
			{
				attributes: { requestId: "request-1" },
				requestDetails: [{ password: "<redacted>" }],
				[kind === "failure" ? "failures" : "defects"]: [{ apiKey: "<redacted>", message: "connect with password=<redacted> failed", status: 503 }],
			},
		]);
		expect(reported).toBeInstanceOf(Error);
		expect(reported).not.toBe(fault);
		expect(reported).toHaveProperty("stack", expect.stringContaining("password=<redacted>"));
		expect(reported).toHaveProperty(ErrorReporter.attributes, { requestId: "request-1" });
		expect(reported).toHaveProperty(ErrorReporter.severity, "Error");
		expect(fault).not.toHaveProperty(ErrorReporter.severity);
		expect(reports[0]?.text).not.toMatch(/plaintext/u);
	});
}

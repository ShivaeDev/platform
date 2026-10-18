import { Cause, Exit } from "effect";
import { expect } from "vitest";
import { Conflict, InternalServerError, ServiceUnavailable } from "#errors/taxonomy.ts";
import { rejections } from "#test/rpc/rejections.ts";
import { original } from "#test/rpc/saveFixture.ts";

rejections.it(
	"unauthenticated native HTTP RPC keeps declared types, redacts unexpected failures and retains causes in server traces",
	[],
	function* ({ save, spans }) {
		const conflict = yield* save("conflict");
		expect(conflict).toBeInstanceOf(Conflict);
		expect(conflict).toMatchObject({ field: "name", message: "Name is taken" });
		expect(yield* save("unavailable")).toBeInstanceOf(ServiceUnavailable);
		for (const mode of ["failure", "defect"]) {
			const rejection = yield* save(mode);
			expect(rejection).toBeInstanceOf(InternalServerError);
			expect(rejection).toMatchObject({ message: "Internal server error" });
			expect(rejection.cause).toBeUndefined();
			expect(JSON.stringify(rejection)).not.toContain("private-value");
		}
		const traced = spans()
			.filter((span) => span.kind === "server" && span.name === "Save")
			.flatMap((span) => {
				if (span.status._tag !== "Ended" || !Exit.isFailure(span.status.exit)) {
					return [];
				}
				return span.status.exit.cause.reasons.filter(Cause.isFailReason).map((reason) => reason.error);
			});
		const unexpected = traced.filter((error) => error instanceof InternalServerError);
		expect(unexpected).toHaveLength(2);
		for (const rejection of unexpected) {
			expect(Cause.isCause(rejection.cause) && Cause.squash(rejection.cause)).toBe(original);
		}
	},
);

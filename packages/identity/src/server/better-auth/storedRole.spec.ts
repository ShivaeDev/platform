import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { signedInWithRole, storedRole } from "#test/better-auth/storedRole.ts";

storedRole.it("alice's declared operator role supplies her grants to the RPC handler", [signedInWithRole("operator")], function* ({ profile }) {
	expect(yield* profile()).toEqual({ permissions: [{ name: "tools.use", strength: "own" }], role: "operator" });
});

storedRole.it("alice's undeclared retired role fails her RPC request as a defect", [signedInWithRole("retired")], function* ({ profile }) {
	expect(yield* profile()).toBe("defect");
});

storedRole.it("alice's undeclared retired role is named in the RPC defect log", [signedInWithRole("retired")], function* ({ defectLogs, profile }) {
	yield* profile();

	expect(yield* defectLogs()).toMatchObject([[{ message: "Stored user role is not declared by the application: retired" }]]);
});

storedRole.it(
	"alice's undeclared retired role makes the session endpoint fail with HTTP 500",
	[signedInWithRole("retired")],
	function* ({ sessionStatus }) {
		expect(yield* sessionStatus()).toBe(HttpStatus.fromLiteral("InternalServerError"));
	},
);

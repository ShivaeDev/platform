import { expect, it } from "vitest";
import { errorMessage } from "#errorMessage.ts";

it("names a failure by its message whether an Error or a bare value was thrown", () => {
	expect(errorMessage(new Error("Read failed"))).toBe("Read failed");
	expect(errorMessage("Read failed")).toBe("Read failed");
});

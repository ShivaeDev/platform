import { expect } from "vitest";
import { browserErrorsStory } from "#test/browser-errors/story.tsx";

for (const kind of ["error", "unhandledrejection"] as const) {
	browserErrorsStory.it(`a mounted hook posts an uncaught ${kind} to the platform route`, [], function* ({ emit, received, reports }) {
		const error = new Error("browser failure");

		yield* emit(kind, error);
		yield* received();

		expect(yield* reports()).toMatchObject([
			{
				body: { kind, message: "browser failure", stack: expect.stringContaining("browser failure"), url: expect.stringContaining("/notes") },
				method: "POST",
				path: "/_platform/errors",
			},
		]);
	});
}

browserErrorsStory.it("a string rejection is posted with its message", [], function* ({ emit, received, reports }) {
	yield* emit("unhandledrejection", "rejected value");
	yield* received();

	expect(yield* reports()).toMatchObject([{ body: { kind: "unhandledrejection", message: "rejected value" } }]);
});

browserErrorsStory.it("unmounting removes both browser error listeners", [], function* ({ emit, received, reports, unmount }) {
	yield* emit("error", "before unmount");
	yield* received();
	const before = yield* reports();
	expect(before).toMatchObject([{ body: { message: "before unmount" } }]);

	yield* unmount();
	yield* emit("error", "after unmount");
	yield* emit("unhandledrejection", "after unmount");

	expect(yield* reports()).toEqual(before);
});

import { inspect } from "node:util";
import { Cause, Context, Effect, ErrorReporter } from "effect";
import { expect, it } from "vitest";
import { redactCause, redactDefect, redactDiagnosticCause, redactingErrorReporter } from "#redactCause.ts";

class Request extends Context.Service<Request, { readonly password: string }>()("errors/test/Request") {}

function leakingError() {
	return Object.assign(new Error("connect with password=hunter2-plaintext failed"), {
		apiKey: "key-plaintext",
		detail: "Authorization: Bearer bearer-plaintext",
		status: 503,
	});
}

it("redactDefect masks an error's message, stack and fields and keeps its name and public fields", () => {
	const defect = redactDefect(leakingError());
	expect(defect).toBeInstanceOf(Error);
	expect(defect).toMatchObject({ apiKey: "<redacted>", detail: "Authorization: <redacted> <redacted>", status: 503 });
	expect(defect).toHaveProperty("message", "connect with password=<redacted> failed");
	expect(defect).toHaveProperty("name", "Error");
	expect(defect).toHaveProperty("stack", expect.stringContaining("password=<redacted>"));
	expect(inspect(defect, { depth: 10 })).not.toMatch(/hunter2-plaintext|key-plaintext|bearer-plaintext/u);
});

it("redactDefect masks a defect that is not an error and honours a widened policy", () => {
	expect(redactDefect({ tenant: "acme", token: "tok-plaintext" })).toEqual({ tenant: "acme", token: "<redacted>" });
	expect(redactDefect({ tenant: "acme" }, (key) => key === "tenant")).toEqual({ tenant: "<redacted>" });
});

it("redactCause masks defects and leaves typed failures and interruptions as they are", () => {
	const failure = { password: "typed-plaintext" };
	const cause = redactCause(Cause.combine(Cause.combine(Cause.fail(failure), Cause.die(leakingError())), Cause.interrupt(7)));
	const [fail, die, interrupt] = cause.reasons;
	expect(fail).toMatchObject({ _tag: "Fail", error: failure });
	expect(die).toMatchObject({ _tag: "Die", defect: { apiKey: "<redacted>", detail: "Authorization: <redacted> <redacted>" } });
	expect(interrupt).toMatchObject({ _tag: "Interrupt", fiberId: 7 });
	expect(inspect(die, { depth: 20 })).not.toMatch(/plaintext/u);
});

it("redactCause keeps the annotations of each defect", () => {
	const annotated = Cause.annotate(Cause.die(leakingError()), Context.make(Request, { password: "annotation-plaintext" }));
	const annotations = redactCause(annotated).reasons.map((reason) => Context.getOrUndefined(Cause.reasonAnnotations(reason), Request));
	expect(annotations).toEqual([{ password: "annotation-plaintext" }]);
});

it("redactDiagnosticCause masks failures, defects and annotations and keeps interruptions", () => {
	const annotated = Cause.annotate(
		Cause.combine(Cause.combine(Cause.fail({ password: "typed-plaintext" }), Cause.die(leakingError())), Cause.interrupt(7)),
		Context.make(Request, { password: "annotation-plaintext" }),
	);
	const cause = redactDiagnosticCause(annotated);
	const [fail, die, interrupt] = cause.reasons;
	expect(fail).toMatchObject({ _tag: "Fail", error: { password: "<redacted>" } });
	expect(die).toMatchObject({ _tag: "Die", defect: { apiKey: "<redacted>", detail: "Authorization: <redacted> <redacted>" } });
	expect(interrupt).toMatchObject({ _tag: "Interrupt", fiberId: 7 });
	const annotations = cause.reasons.map((reason) => Context.getOrUndefined(Cause.reasonAnnotations(reason), Request));
	expect(annotations).toEqual([{ password: "<redacted>" }, { password: "<redacted>" }, { password: "<redacted>" }]);
	expect(inspect(cause.reasons, { depth: 20 })).not.toMatch(/plaintext/u);
});

it("redactingErrorReporter hands the wrapped reporter only masked causes", () => {
	const received: Cause.Cause<unknown>[] = [];
	const inner: ErrorReporter.ErrorReporter = {
		[ErrorReporter.TypeId]: ErrorReporter.TypeId,
		report: ({ cause }) => {
			received.push(cause);
		},
	};
	const fiber = Effect.runSync(Effect.withFiber((current) => Effect.succeed(current)));
	redactingErrorReporter(inner).report({
		cause: Cause.combine(Cause.fail({ password: "typed-plaintext" }), Cause.die(leakingError())),
		fiber,
		timestamp: 0n,
	});
	expect(received).toHaveLength(1);
	expect(received[0]?.reasons).toMatchObject([
		{ _tag: "Fail", error: { password: "<redacted>" } },
		{ _tag: "Die", defect: { apiKey: "<redacted>" } },
	]);
	expect(inspect(received, { depth: 20 })).not.toMatch(/plaintext/u);
});

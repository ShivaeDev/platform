import { Context, Deferred, Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { formStories } from "./formStories.ts";

export const TAKEN_NAME = "taken";
export const TAKEN_MESSAGE = "Name is taken";
export const BROKEN_NAME = "broken";

interface Call {
	readonly answered: Deferred.Deferred<void>;
	readonly release: Deferred.Deferred<string | undefined>;
	readonly started: Deferred.Deferred<void>;
}
interface NameChecks {
	readonly calls: Map<string, Call>;
	readonly checked: string[];
	held: boolean;
}
class NameCheck extends Context.Service<NameCheck, { readonly check: (name: string) => Effect.Effect<string | undefined> }>()("test/NameCheck") {}

function callFor({ calls }: NameChecks, name: string): Call {
	const known = calls.get(name);
	if (known !== undefined) {
		return known;
	}
	const call = { answered: Deferred.makeUnsafe<void>(), release: Deferred.makeUnsafe<string | undefined>(), started: Deferred.makeUnsafe<void>() };
	calls.set(name, call);
	return call;
}

function answerOf(name: string): Effect.Effect<string | undefined> {
	return name === BROKEN_NAME ? Effect.die("the name check is unavailable") : Effect.succeed(name === TAKEN_NAME ? TAKEN_MESSAGE : undefined);
}

// The story hears of each signal after the form finishes its current read, as a remote caller would.
function signalLater(signal: Deferred.Deferred<void>) {
	queueMicrotask(() => Deferred.doneUnsafe(signal, Effect.void));
}

function nameCheck(checks: NameChecks) {
	return {
		check: (name: string) =>
			Effect.suspend(() => {
				checks.checked.push(name);
				const call = callFor(checks, name);
				signalLater(call.started);
				return (checks.held ? Deferred.await(call.release) : answerOf(name)).pipe(Effect.ensuring(Effect.sync(() => signalLater(call.answered))));
			}).pipe(
				// A remote answer arrives even after the form stops waiting for it.
				Effect.uninterruptible,
			),
	};
}

export const checkedNames = formStories(() => Schema.Struct({ name: Schema.String }), {
	config: (checks) => ({
		checks: { name: (value) => Effect.flatMap(NameCheck, (service) => service.check(value)) },
		debounce: "5 millis",
		initialValues: { name: "" },
		onSubmit: Effect.succeed,
		runtime: Atom.runtime(Layer.succeed(NameCheck)(nameCheck(checks))),
	}),
	opened: (form, read) => {
		read(form.error("name"));
	},
	support: (): NameChecks => ({ calls: new Map(), checked: [], held: false }),
	verbs: (driver, tell, checks) => ({
		answerCheck: (name: string, message: string) => {
			tell(`the name check answers ${JSON.stringify(name)} with ${JSON.stringify(message)}`);
			const call = callFor(checks, name);
			return Deferred.succeed(call.release, message).pipe(Effect.andThen(Deferred.await(call.answered)));
		},
		checkedNamesSoFar: () => Effect.sync(() => [...checks.checked]),
		enterName: (name: string) => {
			tell(`enter ${JSON.stringify(name)} as the name and wait for its check to ${checks.held ? "start" : "answer"}`);
			return Effect.suspend(() => {
				driver.current().change("name", name);
				const call = callFor(checks, name);
				return Deferred.await(checks.held ? call.started : call.answered);
			});
		},
	}),
});

export function checksWaitForAnswers() {
	return checkedNames.trait("form", "the name check answers only when told to", (engine) => {
		engine.support.held = true;
	});
}

export function nameChecked(name: string) {
	return checkedNames.step(`${JSON.stringify(name)} is entered as the name and its check starts or answers`, (driver, engine) => {
		driver.current().change("name", name);
		const call = callFor(engine.support, name);
		return Deferred.await(engine.support.held ? call.started : call.answered);
	});
}

export function checkAnswered(name: string, message: string) {
	return checkedNames.step(`the name check answers ${JSON.stringify(name)} with ${JSON.stringify(message)}`, (_driver, engine) => {
		const call = callFor(engine.support, name);
		return Deferred.succeed(call.release, message).pipe(Effect.andThen(Deferred.await(call.answered)));
	});
}

export const SHORT_NAME_MESSAGE = "Expected a value with a length of at least 3";
export function namesNeedThreeCharacters() {
	return checkedNames.schemaIs("the name needs at least 3 characters", Schema.Struct({ name: Schema.String.check(Schema.isMinLength(3)) }));
}

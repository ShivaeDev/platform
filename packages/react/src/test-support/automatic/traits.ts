import { Effect } from "effect";
import { automatic } from "#test/automatic/automatic.ts";
import { live } from "#test/automatic/engine.ts";
import { automaticVerbs } from "#test/automatic/verbs.ts";

export function notesShown() {
	return automatic.trait("screen", "alice's screen shows live notes First and Second", live);
}

export function secondHiddenThenRenamed() {
	return automatic.trait("screen", "alice hid the second note's query, and another host then renamed note 2 to While unmounted", function* (engine) {
		yield* live(engine);
		const { anotherHostRenames, hideSecond } = automaticVerbs(engine);
		yield* hideSecond();
		yield* anotherHostRenames(2, "While unmounted");
	});
}

export function firstRenamedByAnotherHost(title: string) {
	return automatic.trait("screen", `another host renamed note 1 to ${title} and alice's screen shows it`, function* (engine) {
		yield* live(engine);
		yield* automaticVerbs(engine).anotherHostRenamesShown(1, title);
		engine.marked.set(1, engine.screen.query(1));
	});
}

export function socketDropped(renamedWhileDown: boolean) {
	const rename = renamedWhileDown ? ", and another host renamed note 1 to Changed while disconnected" : "";
	return automatic.trait("screen", `alice's screen shows only note 1 and its socket dropped${rename}`, function* (engine) {
		yield* live(engine);
		const { anotherHostRenames, dropSocket, hideSecond } = automaticVerbs(engine);
		yield* hideSecond();
		yield* dropSocket();
		if (renamedWhileDown) {
			yield* anotherHostRenames(1, "Changed while disconnected");
		}
	});
}

export function separateScreenOpen(firstClosed: boolean) {
	const closed = firstClosed ? ", and the first screen was then closed" : "";
	return automatic.trait(
		"screen",
		`a second screen for note 2 runs in an independent registry beside alice's first screen${closed}`,
		function* (engine) {
			yield* live(engine);
			yield* Effect.promise(engine.screen.openSeparate);
			yield* automaticVerbs(engine).settle(engine.screen.separateContainer);
			if (firstClosed) {
				yield* Effect.promise(engine.screen.closePrimary);
			}
		},
	);
}

export function workerCommitted() {
	return automatic.trait("screen", "a pg-boss worker committed note 1 as From worker and alice's screen shows it", function* (engine) {
		yield* live(engine);
		yield* automaticVerbs(engine).workerCommits(1, "From worker");
	});
}

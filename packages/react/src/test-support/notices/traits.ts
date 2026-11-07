import { open, optionWords } from "#test/notices/open.tsx";
import { noticesStory } from "#test/notices/story.tsx";
import { noticeVerbs } from "#test/notices/verbs.tsx";
import type { NoticeScreen } from "#test/notices/view.tsx";

export function noticeScreen(options: Partial<NoticeScreen> = {}) {
	return noticesStory.trait("screen", `alice's notes${optionWords(options)}, showing existing`, (engine) => open(engine, options));
}

export function removalNoticed(title: string, options: Partial<NoticeScreen> = {}) {
	return noticesStory.trait("screen", `alice removed ${title}${optionWords(options)} and holds its Removed ${title} notice`, function* (engine) {
		yield* open(engine, options);
		const { completeRemove, remove } = noticeVerbs(engine.state, engine.screen);
		yield* remove(title);
		yield* completeRemove(title);
	});
}

export function twoRemovalNotices() {
	return noticesStory.trait("screen", "alice removed second and then first, and holds both notices", function* (engine) {
		yield* open(engine, {});
		const { completeRemove, remove } = noticeVerbs(engine.state, engine.screen);
		yield* remove("second");
		yield* completeRemove("second");
		yield* remove("first");
		yield* completeRemove("first");
	});
}

export function twoRemovalsHeld(secondCompleted: boolean) {
	const second = secondCompleted ? ", and second has completed" : "";
	return noticesStory.trait("screen", `alice removed first and then second, both held by the server${second}`, function* (engine) {
		yield* open(engine, {});
		const { completeRemove, remove } = noticeVerbs(engine.state, engine.screen);
		yield* remove("first");
		yield* remove("second");
		if (secondCompleted) {
			yield* completeRemove("second");
		}
	});
}

export function removalHeldAcrossSessionChange() {
	return noticesStory.trait("screen", "alice's removal of first is held while bob's session replaces hers", function* (engine) {
		yield* open(engine, {});
		const { remove, replaceSession } = noticeVerbs(engine.state, engine.screen);
		yield* remove("first");
		yield* replaceSession("bob");
	});
}

export function refreshFailed() {
	return noticesStory.trait("screen", "alice's notes refreshed against a failing server and published Refresh failed", function* (engine) {
		yield* open(engine, {});
		yield* noticeVerbs(engine.state, engine.screen).breakRefresh();
	});
}

export function formSubmitted(title: string) {
	return noticesStory.trait("screen", `alice submitted the form with ${title} and the server holds it`, function* (engine) {
		yield* open(engine, {});
		const { submitForm, type } = noticeVerbs(engine.state, engine.screen);
		yield* type(title);
		yield* submitForm();
	});
}

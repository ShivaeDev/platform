import { open, optionWords } from "#test/notices/open.tsx";
import { noticesStory } from "#test/notices/story.tsx";
import { noticeVerbs } from "#test/notices/verbs.tsx";
import type { NoticeScreen } from "#test/notices/view.tsx";

export function undoWaiting(title: string, options: Partial<NoticeScreen> = {}) {
	return noticesStory.trait("screen", `alice removed ${title}${optionWords(options)} and the server holds her Undo`, function* (engine) {
		yield* open(engine, options);
		const { completeRemove, remove, undo } = noticeVerbs(engine.state, engine.screen);
		yield* remove(title);
		yield* completeRemove(title);
		yield* undo(title);
	});
}

export function conflictingUndoWaiting() {
	return noticesStory.trait("screen", "alice removed first, another edit bumped its version, and the server holds her Undo", function* (engine) {
		yield* open(engine, {});
		const { completeRemove, editFirst, remove, undo } = noticeVerbs(engine.state, engine.screen);
		yield* remove("first");
		yield* completeRemove("first");
		yield* editFirst();
		yield* undo("first");
	});
}

export function undoInterruptedByClosingHost() {
	return noticesStory.trait("screen", "alice closed the notice host while the server held her Undo of first", function* (engine) {
		yield* open(engine, {});
		const { closeHost, completeRemove, remove, undo } = noticeVerbs(engine.state, engine.screen);
		yield* remove("first");
		yield* completeRemove("first");
		yield* undo("first");
		yield* closeHost();
	});
}

export function undoHeldAcrossSessionChange() {
	return noticesStory.trait("screen", "alice's uninterruptible Undo of first is held while bob's session replaces hers", function* (engine) {
		yield* open(engine, { uninterruptible: true });
		const { completeRemove, remove, replaceSession, undo } = noticeVerbs(engine.state, engine.screen);
		yield* remove("first");
		yield* completeRemove("first");
		yield* undo("first");
		yield* replaceSession("bob");
	});
}

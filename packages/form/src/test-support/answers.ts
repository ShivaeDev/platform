import { Effect } from "effect";
import type * as Atom from "effect/reactivity/Atom";

interface Keyed {
	readonly id: PropertyKey;
}

export interface AnswerAccess<TAnswer extends Keyed> {
	readonly answers: () => readonly TAnswer[];
	readonly change: (answers: readonly TAnswer[]) => void;
	readonly errorAt: (path: readonly ["answers", ...PropertyKey[]]) => string | undefined;
	readonly leave: () => void;
	readonly summary: () => string | undefined;
}

interface AnswersDriver<TAnswer extends Keyed> {
	readonly current: () => {
		readonly blur: (name: "answers") => void;
		readonly change: (name: "answers", value: readonly TAnswer[]) => void;
		readonly error: (name: "answers") => Atom.Atom<string | undefined>;
		readonly errorAt: (path: readonly ["answers", ...PropertyKey[]]) => Atom.Atom<string | undefined>;
		readonly values: { readonly value: { readonly answers: readonly TAnswer[] } };
	};
	readonly read: <T>(atom: Atom.Atom<T>) => T;
}

export function answerAccess<TAnswer extends Keyed>({ current, read }: AnswersDriver<TAnswer>): AnswerAccess<TAnswer> {
	return {
		answers: () => current().values.value.answers,
		change: (answers) => current().change("answers", answers),
		errorAt: (path) => read(current().errorAt(path)),
		leave: () => current().blur("answers"),
		summary: () => read(current().error("answers")),
	};
}

function positionOf(answers: readonly Keyed[], id: PropertyKey) {
	const positions = answers.flatMap((answer, index) => (answer.id === id ? [index] : []));
	const [position] = positions;
	if (positions.length !== 1 || position === undefined) {
		throw new Error(`The form holds ${positions.length} answers keyed ${String(id)}, so none can be named by that key`);
	}
	return position;
}

export const answerMoves = {
	add: <TAnswer extends Keyed>(answers: readonly TAnswer[], answer: TAnswer) => [...answers, { ...answer }],
	edit: <TAnswer extends Keyed>(answers: readonly TAnswer[], id: PropertyKey, changes: Partial<TAnswer>) =>
		answers.map((answer) => (answer.id === id ? { ...answer, ...changes } : { ...answer })),
	insertBefore: <TAnswer extends Keyed>(answers: readonly TAnswer[], id: PropertyKey, inserted: TAnswer) =>
		answers.flatMap((answer) => (answer.id === id ? [{ ...inserted }, { ...answer }] : [{ ...answer }])),
	moveToFront: <TAnswer extends Keyed>(answers: readonly TAnswer[], id: PropertyKey) => {
		const moved = answers[positionOf(answers, id)];
		return [...(moved ? [{ ...moved }] : []), ...answers.filter((answer) => answer.id !== id).map((answer) => ({ ...answer }))];
	},
	remove: <TAnswer extends Keyed>(answers: readonly TAnswer[], id: PropertyKey) =>
		answers.filter((answer) => answer.id !== id).map((answer) => ({ ...answer })),
	replace: <TAnswer extends Keyed>(answers: readonly TAnswer[], id: PropertyKey, replacement: TAnswer) =>
		answers.map((answer) => (answer.id === id ? { ...replacement } : { ...answer })),
};

export function answerVerbs<TAnswer extends Keyed>(access: AnswerAccess<TAnswer>, tell: (line: string) => void) {
	function move(line: string, next: (answers: readonly TAnswer[]) => readonly TAnswer[]) {
		return Effect.sync(() => {
			tell(line);
			access.change(next(access.answers()));
		});
	}
	return {
		addAnswer: (answer: TAnswer) => move(`add the ${String(answer.id)} answer at the end`, (answers) => answerMoves.add(answers, answer)),
		answerError: (id: PropertyKey, ...part: PropertyKey[]) =>
			Effect.sync(() => access.errorAt(["answers", positionOf(access.answers(), id), ...part])),
		answerErrorAt: (position: number, ...part: PropertyKey[]) => Effect.sync(() => access.errorAt(["answers", position, ...part])),
		answersSummary: () => Effect.sync(access.summary),
		editAnswer: (id: PropertyKey, changes: Partial<TAnswer>) =>
			move(`edit the ${String(id)} answer to ${JSON.stringify(changes)}`, (answers) => answerMoves.edit(answers, id, changes)),
		insertAnswerBefore: (id: PropertyKey, answer: TAnswer) =>
			move(`insert the ${String(answer.id)} answer before the ${String(id)} answer`, (answers) => answerMoves.insertBefore(answers, id, answer)),
		leaveAnswers: () =>
			Effect.sync(() => {
				tell("leave the answers");
				access.leave();
			}),
		moveAnswerToFront: (id: PropertyKey) => move(`move the ${String(id)} answer to the front`, (answers) => answerMoves.moveToFront(answers, id)),
		removeAnswer: (id: PropertyKey) => move(`remove the ${String(id)} answer`, (answers) => answerMoves.remove(answers, id)),
		replaceAnswer: (id: PropertyKey, replacement: TAnswer) =>
			move(`replace the ${String(id)} answer with ${JSON.stringify(replacement)}`, (answers) => answerMoves.replace(answers, id, replacement)),
	};
}

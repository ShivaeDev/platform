import { act, createElement } from "react";
import { expect, it } from "vitest";
import { eventually, expectNoReactWarnings, render } from "#client/testing.ts";
import { AnswerList } from "#test/AnswerList.tsx";
import { answerValues, makeAnswerForm } from "#test/answerForm.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

it("React renders Schema and server messages next to their answer after array edits", async () => {
	const { first, second, third } = answerValues;
	const form = makeAnswerForm();
	const { container, unmount } = await render(createElement(AnswerList, { form }));
	function messages() {
		return [...container.querySelectorAll("li")].map((item) => [item.getAttribute("data-answer"), item.querySelector('[role="alert"]')?.textContent]);
	}
	try {
		expect(messages()).toEqual([
			["first", undefined],
			["second", undefined],
			["third", undefined],
		]);
		await act(async () => container.querySelector("button")?.click());
		await eventually(() =>
			expect(messages()).toEqual([
				["first", undefined],
				["second", undefined],
				["third", "Required"],
			]),
		);
		await act(async () => form.change("answers", [third, second]));
		await eventually(() =>
			expect(messages()).toEqual([
				["third", "Required"],
				["second", undefined],
			]),
		);
		const rejected = { ...third, text: "Valid" };
		await act(async () => form.change("answers", [rejected, second]));
		await act(async () => container.querySelector("button")?.click());
		await eventually(() =>
			expect(messages()).toEqual([
				["third", "Answer is closed"],
				["second", undefined],
			]),
		);
		await act(async () => form.change("answers", [first, second, { ...rejected }]));
		await eventually(() =>
			expect(messages()).toEqual([
				["first", undefined],
				["second", undefined],
				["third", "Answer is closed"],
			]),
		);
		await act(async () => form.change("answers", [second, rejected]));
		await eventually(() =>
			expect(messages()).toEqual([
				["second", undefined],
				["third", "Answer is closed"],
			]),
		);
		await act(async () => form.change("answers", [rejected, second]));
		await eventually(() =>
			expect(messages()).toEqual([
				["third", "Answer is closed"],
				["second", undefined],
			]),
		);
		await act(async () => form.change("answers", [second]));
		await eventually(() => expect(messages()).toEqual([["second", undefined]]));
	} finally {
		await unmount();
	}
});

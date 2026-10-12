import { at } from "./at.ts";

type Signature = string | undefined;
function edges(a: readonly Signature[], b: readonly string[]) {
	let start = 0;
	while (start < a.length && start < b.length && a[start] === b[start]) {
		start += 1;
	}
	let tail = 0;
	while (tail < a.length - start && tail < b.length - start && a.at(-1 - tail) === b.at(-1 - tail)) {
		tail += 1;
	}
	return { start, tail };
}
function scores(a: readonly Signature[], b: readonly string[], start: number, tail: number) {
	const n = a.length - start - tail;
	const m = b.length - start - tail;
	const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
	function score(i: number, j: number) {
		return at(at(table, i), j);
	}
	for (let i = n - 1; i >= 0; i -= 1) {
		for (let j = m - 1; j >= 0; j -= 1) {
			at(table, i)[j] = a[start + i] === b[start + j] ? score(i + 1, j + 1) + 1 : Math.max(score(i + 1, j), score(i, j + 1));
		}
	}
	return { m, n, score };
}
export function matches(a: readonly Signature[], b: readonly string[]): [number, number][] {
	const { start, tail } = edges(a, b);
	const { m, n, score } = scores(a, b, start, tail);
	const pairs: [number, number][] = Array.from({ length: start }, (_, index) => [index, index]);
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (a[start + i] === b[start + j]) {
			pairs.push([start + i, start + j]);
			i += 1;
			j += 1;
		} else if (score(i + 1, j) >= score(i, j + 1)) {
			i += 1;
		} else {
			j += 1;
		}
	}
	for (let index = tail; index > 0; index -= 1) {
		pairs.push([a.length - index, b.length - index]);
	}
	pairs.push([a.length, b.length]);
	return pairs;
}

import { settle } from "#settle.ts";
import { type StateTrait, storyKit } from "#storyKit.ts";
import type { StoryLog } from "#storyLog.ts";

export interface Bakery {
	bowls: number;
	capacity: number;
	dough: number;
	flour: number;
	loaves: number;
	minute: number;
	ovenLit: boolean;
	starter: boolean;
}

export interface BakeReport {
	readonly loaves: number;
	readonly minutes: number;
}

const DOUGH_PER_BOWL = 3;

export function emptyBakery(): Bakery {
	return { bowls: 1, capacity: 0, dough: 0, flour: 0, loaves: 0, minute: 0, ovenLit: false, starter: false };
}

export function fitBowls(bakery: Bakery): void {
	bakery.capacity = bakery.bowls * DOUGH_PER_BOWL;
}

export type BakeryTrait = StateTrait<Bakery, "kitchen" | "pantry">;

const kit = storyKit<Bakery>()("kitchen", "pantry");

export const { traits } = kit;

export function hasBowls(count: number) {
	return kit.trait("kitchen", `the bakery has ${count} bowls`, (bakery) => {
		bakery.bowls = count;
	});
}

export function ovenIsLit() {
	return kit.trait("kitchen", "the oven is lit", (bakery) => {
		bakery.ovenLit = true;
	});
}

export function keepsSourdough() {
	return kit.trait("kitchen", "the baker keeps a sourdough starter", (bakery) => {
		bakery.starter = true;
	});
}

export function hasDough(count: number) {
	return kit.trait("pantry", `the baker has ${count} balls of dough`, (bakery) => {
		if (count > bakery.capacity) {
			throw new Error(`the bowls hold only ${bakery.capacity}`);
		}
		bakery.dough = count;
	});
}

function bakeOneLoaf(bakery: Bakery, log: StoryLog): void {
	bakery.minute += 1;
	if (bakery.starter) {
		bakery.dough += 1;
	}
	bakery.dough -= 1;
	bakery.loaves += 1;
	log.tell(`${bakery.minute}m a loaf comes out of the oven`);
}

export function coldOven(bakery: Bakery): Error | undefined {
	return !bakery.ovenLit && bakery.dough > 0 ? new Error(`the oven is cold with ${bakery.dough} balls of dough waiting`) : undefined;
}

export function stillWaiting(bakery: Bakery): string {
	return `${bakery.dough} balls of dough still wait after ${bakery.minute} minutes${bakery.starter ? ": the sourdough starter never runs out" : ""}`;
}

export function newBakery(...given: readonly BakeryTrait[]) {
	const bakery = emptyBakery();
	const log = kit.seed(bakery, given, { after: { kitchen: fitBowls } });
	return {
		baker: {
			kneads: (count: number) => {
				log.tell(`the baker kneads ${count} balls of dough`);
				bakery.dough += count;
			},
		},
		bakery,
		log,
		oven: {
			bakesEverything: (within = 60): BakeReport =>
				settle(log, {
					cap: within,
					diagnose: () => stillWaiting(bakery),
					failed: () => coldOven(bakery),
					report: () => ({ loaves: bakery.loaves, minutes: bakery.minute }),
					settled: () => bakery.dough === 0,
					step: () => bakeOneLoaf(bakery, log),
				}),
		},
	};
}

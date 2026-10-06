import { storyKit, type Trait } from "#storyKit.ts";

export interface Bakery {
	bowls: number;
	capacity: number;
	dough: number;
	flour: number;
	loaves: number;
	minute: number;
	orders: string[];
	ovenLit: boolean;
	smoking: boolean;
	starter: boolean;
}

export interface BakeReport {
	readonly loaves: number;
	readonly minutes: number;
}

export type BakeryTrait = Trait<Bakery, "kitchen" | "pantry">;

const DOUGH_PER_BOWL = 3;

export function emptyBakery(): Bakery {
	return { bowls: 1, capacity: 0, dough: 0, flour: 0, loaves: 0, minute: 0, orders: [], ovenLit: false, smoking: false, starter: false };
}

export function fitBowls(state: Bakery): void {
	state.capacity = state.bowls * DOUGH_PER_BOWL;
}

export function ovenTrouble(state: Bakery): string | undefined {
	if (state.smoking) {
		return "the oven fills the bakery with smoke";
	}
	return !state.ovenLit && state.dough > 0 ? `the oven is cold with ${state.dough} balls of dough waiting` : undefined;
}

export function stillWaiting(state: Bakery): string {
	return `${state.dough} balls of dough still wait after ${state.minute} minutes${state.starter ? ": the sourdough starter never runs out" : ""}`;
}

function bakeOneLoaf(state: Bakery, tell: (line: string) => void): void {
	state.minute += 1;
	if (state.starter) {
		state.dough += 1;
	}
	state.dough -= 1;
	state.loaves += 1;
	tell(`${state.minute}m a loaf comes out of the oven`);
}

const bakery = storyKit({
	after: { kitchen: fitBowls },
	create: emptyBakery,
	name: "bakery",
	run: { diagnose: stillWaiting, failed: ovenTrouble, maxSteps: 60, step: bakeOneLoaf },
	stages: ["kitchen", "pantry"],
	verbs: (state, story) => ({
		baker: {
			kneads: (count: number) => {
				story.tell(`the baker kneads ${count} balls of dough`);
				state.dough += count;
			},
		},
		oven: {
			bakesEverything: (maxSteps?: number): BakeReport => {
				story.runUntil((current) => current.dough === 0, { maxSteps });
				return { loaves: state.loaves, minutes: state.minute };
			},
		},
	}),
});

export const newBakery = bakery.start;

export const { traits } = bakery;

export function hasBowls(count: number) {
	return bakery.trait("kitchen", `the bakery has ${count} bowls`, (state) => {
		state.bowls = count;
	});
}

export function ovenIsLit() {
	return bakery.trait("kitchen", "the oven is lit", (state) => {
		state.ovenLit = true;
	});
}

export function ovenSmokes() {
	return bakery.trait("kitchen", "the oven smokes", (state) => {
		state.smoking = true;
	});
}

export function keepsSourdough() {
	return bakery.trait("kitchen", "the baker keeps a sourdough starter", (state) => {
		state.starter = true;
	});
}

export function hasDough(count: number) {
	return bakery.trait("pantry", `the baker has ${count} balls of dough`, (state) => {
		if (count > state.capacity) {
			throw new Error(`the bowls hold only ${state.capacity}`);
		}
		state.dough = count;
	});
}

export function hasOrders(count: number) {
	return bakery.trait("pantry", `the bakery has ${count} orders`, (state) => {
		state.orders = Array.from({ length: count }, (_, index) => `order ${index + 1}: a loaf of rye for the market stall`);
	});
}

export function morningShift(): BakeryTrait {
	return traits(ovenIsLit(), hasBowls(1));
}

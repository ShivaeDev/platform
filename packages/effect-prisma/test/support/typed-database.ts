import { makeDatabase } from "../../src/index.ts";
import { type Contract, contractJson } from "../contract.ts";

export type User = {
	id: string;
	email: string;
	name: string;
	createdAt: Date;
	verifiedAt: Date | null;
};

export type Post = {
	id: string;
	reviewerId: string | null;
	title: string;
	userId: string;
};

export const Database = makeDatabase<Contract>()("@test/Database", { contractJson });
export const AuditDatabase = makeDatabase<Contract>()("@test/AuditDatabase", {
	contractJson,
});

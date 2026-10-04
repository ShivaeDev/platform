import { makeDatabase } from "../../src/index.ts";
import { type Contract, contractJson } from "../contract.ts";

export interface User {
	createdAt: Date;
	email: string;
	id: string;
	name: string;
	verifiedAt: Date | null;
}

export interface Post {
	id: string;
	reviewerId: string | null;
	title: string;
	userId: string;
}

export const Database = makeDatabase<Contract>()("@test/Database", { contractJson });
export const AuditDatabase = makeDatabase<Contract>()("@test/AuditDatabase", {
	contractJson,
});

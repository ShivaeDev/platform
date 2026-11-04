import { HttpClient } from "effect/http";
import { defineService } from "@shivaedev/service/defineService.ts";
import { genericMethod } from "@shivaedev/service/genericMethod.ts";
import { GitHubToken } from "#GitHubToken.ts";
import { graphqlRequests } from "#graphqlRequests.ts";
import { initializeGitHub } from "#initializeGitHub.ts";
import { bytes } from "#operations/bytes.ts";
import { compareCommits } from "#operations/compareCommits.ts";
import { createCheckRun } from "#operations/createCheckRun.ts";
import { downloadArtifactArchive } from "#operations/downloadArtifactArchive.ts";
import { findLatestCheckRun } from "#operations/findLatestCheckRun.ts";
import { getCollaboratorPermission } from "#operations/getCollaboratorPermission.ts";
import { getCommit } from "#operations/getCommit.ts";
import { getIssue } from "#operations/getIssue.ts";
import { getTree } from "#operations/getTree.ts";
import { getUser } from "#operations/getUser.ts";
import { list } from "#operations/list.ts";
import { listCommits } from "#operations/listCommits.ts";
import { listIssues } from "#operations/listIssues.ts";
import { listPullRequestFiles } from "#operations/listPullRequestFiles.ts";
import { observations } from "#operations/observations.ts";
import { read } from "#operations/read.ts";
import { resource } from "#operations/resource.ts";
import { text } from "#operations/text.ts";
import { updateCheckRun } from "#operations/updateCheckRun.ts";
import { upsertCheckRun } from "#operations/upsertCheckRun.ts";
import { upsertStickyComment } from "#operations/upsertStickyComment.ts";
import { write } from "#operations/write.ts";

export const GitHub = defineService({
	id: "@shivaedev/github/GitHub",
	initialize: initializeGitHub,
	methods: (state) => ({
		bytes: bytes(state),
		compareCommits: compareCommits(state.client),
		createCheckRun: createCheckRun(state.client),
		downloadArtifactArchive: downloadArtifactArchive(state.archive),
		findLatestCheckRun: findLatestCheckRun(state.client),
		getCollaboratorPermission: getCollaboratorPermission(state.client),
		getCommit: getCommit(state.client),
		getIssue: getIssue(state.client),
		getTree: getTree(state.client),
		getUser: getUser(state.client),
		graphql: graphqlRequests(state.apiUrl, state.client),
		list: genericMethod(list(state)),
		listCommits: genericMethod(listCommits(state.client)),
		listIssues: genericMethod(listIssues(state.client)),
		listPullRequestFiles: genericMethod(listPullRequestFiles(state.client)),
		observations: observations(state),
		read: read(state),
		resource: resource(state),
		text: text(state),
		updateCheckRun: updateCheckRun(state.client),
		upsertCheckRun: upsertCheckRun(state.client),
		upsertStickyComment: upsertStickyComment(state.client),
		write: write(state),
	}),
	requires: [HttpClient.HttpClient, GitHubToken],
});

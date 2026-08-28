import { describe, expect, it } from "vitest";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Tier2ToolIndex, type Tier2ToolEntry } from "./bm25-index";

function entry(
  actionName: string,
  toolName: string,
  serverName: string,
  platform: string,
  description = "",
): Tier2ToolEntry {
  return {
    actionName,
    toolName,
    serverName,
    platform,
    tool: {
      name: toolName,
      description,
      inputSchema: { type: "object" },
    } as Tool,
  };
}

describe("Tier2ToolIndex", () => {
  it("discovers tools by action name and ranks the direct name match first", () => {
    const index = new Tier2ToolIndex();
    const searchIssues = entry(
      "GITHUB_SEARCH_ISSUES",
      "search_issues",
      "github",
      "github",
      "Search repository issues",
    );
    const listRepos = entry(
      "GITHUB_LIST_REPOSITORIES",
      "list_repositories",
      "github",
      "github",
      "List repositories",
    );
    index.build([listRepos, searchIssues]);

    const results = index.search("GITHUB_SEARCH_ISSUES");

    expect(results[0]).toBe(searchIssues);
    expect(index.getToolCount()).toBe(2);
  });

  it("discovers tools through tokenized underscore and hyphen name fragments", () => {
    const index = new Tier2ToolIndex();
    const jiraIssues = entry(
      "JIRA_DISCOVER",
      "jira_search-issues",
      "atlassian",
      "jira",
      "Find work items",
    );
    const calendar = entry(
      "CALENDAR_DISCOVER",
      "calendar_list_events",
      "google",
      "calendar",
      "List calendar events",
    );
    index.build([calendar, jiraIssues]);

    expect(index.search("issues")).toEqual([jiraIssues]);
    expect(index.search("search")).toEqual([jiraIssues]);
  });

  it("indexes server and platform terms in addition to tool names", () => {
    const index = new Tier2ToolIndex();
    const linear = entry(
      "CREATE_WORK_ITEM",
      "create_item",
      "linear-mcp",
      "linear",
      "Create a work item",
    );
    const github = entry(
      "CREATE_REPO_ITEM",
      "create_item",
      "github-mcp",
      "github",
      "Create a repository item",
    );
    index.build([github, linear]);

    expect(index.search("linear-mcp")).toContain(linear);
    expect(index.search("linear")).toContain(linear);
    expect(index.search("github")).toContain(github);
  });

  it("filters platform case-insensitively and paginates after filtering", () => {
    const index = new Tier2ToolIndex();
    const githubOne = entry(
      "TICKET_ONE",
      "ticket_one",
      "github-a",
      "GitHub",
      "ticket workflow",
    );
    const githubTwo = entry(
      "TICKET_TWO",
      "ticket_two",
      "github-b",
      "github",
      "ticket workflow",
    );
    const githubThree = entry(
      "TICKET_THREE",
      "ticket_three",
      "github-c",
      "GITHUB",
      "ticket workflow",
    );
    const linearOne = entry(
      "TICKET_LINEAR_ONE",
      "ticket_linear_one",
      "linear-a",
      "linear",
      "ticket workflow",
    );
    const linearTwo = entry(
      "TICKET_LINEAR_TWO",
      "ticket_linear_two",
      "linear-b",
      "linear",
      "ticket workflow",
    );
    index.build([
      githubOne,
      githubTwo,
      githubThree,
      linearOne,
      linearTwo,
    ]);

    const fullGithubPage = index.search("ticket", "gItHuB", 10, 0);
    const secondGithub = index.search("ticket", "GITHUB", 1, 1);

    expect(fullGithubPage).toHaveLength(3);
    expect(fullGithubPage.every((tool) => tool.platform.toLowerCase() === "github")).toBe(true);
    expect(secondGithub).toEqual([fullGithubPage[1]]);
  });

  it("replaces prior builds instead of retaining disconnected-server tools", () => {
    const index = new Tier2ToolIndex();
    const oldTool = entry(
      "OLD_SEARCH",
      "old_search",
      "old-server",
      "legacy",
      "legacy lookup",
    );
    const newTool = entry(
      "NEW_SEARCH",
      "new_search",
      "new-server",
      "current",
      "current lookup",
    );

    index.build([oldTool]);
    expect(index.search("legacy")).toEqual([oldTool]);

    index.build([newTool]);

    expect(index.getToolCount()).toBe(1);
    expect(index.search("legacy")).toEqual([]);
    expect(index.search("current")).toEqual([newTool]);
  });

  it("clears the index completely when rebuilt with an empty tool set", () => {
    const index = new Tier2ToolIndex();
    index.build([
      entry(
        "GITHUB_SEARCH",
        "github_search",
        "github",
        "github",
        "Search GitHub",
      ),
    ]);
    expect(index.getToolCount()).toBe(1);

    index.build([]);

    expect(index.getToolCount()).toBe(0);
    expect(index.search("github")).toEqual([]);
  });
});

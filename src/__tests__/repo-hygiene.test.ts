import { execFileSync } from "child_process";
import fs from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";

describe("repo hygiene", () => {
  it("keeps generated dependency and OpenCode state ignored and untracked", async () => {
    const gitignore = await fs.readFile(
      path.join(process.cwd(), ".gitignore"),
      "utf-8",
    );
    expect(gitignore).toContain("node_modules/");
    expect(gitignore).toContain(".opencode/");

    const trackedNodeModules = execFileSync(
      "git",
      ["ls-files", "node_modules"],
      {
        cwd: process.cwd(),
        encoding: "utf-8",
      },
    ).trim();

    expect(trackedNodeModules).toBe("");

    const trackedOpenCodeState = execFileSync(
      "git",
      ["ls-files", ".opencode"],
      {
        cwd: process.cwd(),
        encoding: "utf-8",
      },
    ).trim();

    expect(trackedOpenCodeState).toBe("");
  });
});

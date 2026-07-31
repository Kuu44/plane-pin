// Screenshots the renderer against a stubbed bridge so card density and the
// task-only rail can be checked without a live Plane workspace.
//
// Run `npm run preview:renderer`. Set PLAYWRIGHT_CHROMIUM to override the
// installed Chrome/Edge executable used for the screenshots.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const packageVersion = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const page_url = pathToFileURL(path.join(root, "src", "renderer", "index.html")).href;
const outputDir = process.argv[2] || "/tmp/plane-pin-preview";
fs.mkdirSync(outputDir, { recursive: true });

const browserCandidates = [
  process.env.PLAYWRIGHT_CHROMIUM,
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Microsoft", "Edge", "Application", "msedge.exe"),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
].filter(Boolean);
const executablePath = browserCandidates.find((candidate) => fs.existsSync(candidate));

const tasks = [
  ["MKTG-99", "Draft the launch announcement for the new pricing page", "In Progress", "started", "#f59e0b", "high", "Marketing"],
  ["MKTG-84", "Review paid search creative with the agency", "In Review", "started", "#8b5cf6", "medium", "Marketing"],
  ["MKTG-71", "Prepare launch brief", "Todo", "unstarted", "#60646c", "none", "Marketing"],
  ["ENG-412", "Fix the token refresh race on cold start", "In Progress", "started", "#f59e0b", "urgent", "Engineering"],
  ["ENG-388", "Split the settings migration out of main", "Backlog", "backlog", "#60646c", "low", "Engineering"],
  ["ENG-377", "Add retry budget to the Plane client", "Todo", "unstarted", "#60646c", "medium", "Engineering"]
].map(([identifier, name, stateName, stateGroup, stateColor, priority, projectName], index) => ({
  id: String(index),
  identifier,
  name,
  stateName,
  stateGroup,
  stateColor,
  priority,
  estimate: ["M", "S", "", "XL", "L", "S"][index],
  projectName,
  projectId: projectName === "Marketing" ? "project-marketing" : "project-engineering",
  projectIdentifier: identifier.split("-")[0],
  assignees: [{ id: "94cf0210-9909-4f77-b24e-14b2988156e5", name: "Kuu" }],
  targetDate: index === 0 ? "2026-08-04" : null,
  url: "https://plane.example.com/engineering/browse/" + identifier
}));

async function open(browser, { compactCards, theme, priorityStyle = "dot", view = "tasks" }) {
  const page = await browser.newPage({ viewport: view === "settings" ? { width: 560, height: 760 } : { width: 380, height: 650 } });
  page.on("console", (message) => {
    if (message.type() === "error") console.error(`renderer console: ${message.text()}`);
  });
  page.on("pageerror", (error) => console.error(`renderer error: ${error.message}`));
  await page.addInitScript(
    ({ tasks, compactCards, theme, priorityStyle, packageVersion }) => {
      const settings = {
        schemaVersion: 4,
        baseUrl: "https://plane.example.com",
        workspaceSlug: "engineering",
        memberId: "94cf0210-9909-4f77-b24e-14b2988156e5",
        memberName: "Kuu",
        assigneeIds: ["94cf0210-9909-4f77-b24e-14b2988156e5"],
        projectIds: null,
        stateNames: null,
        memberOrder: ["94cf0210-9909-4f77-b24e-14b2988156e5"],
        projectOrder: ["project-engineering", "project-marketing"],
        stateOrder: ["In Progress", "In Review", "Todo", "Backlog"],
        groupByProject: true,
        groupByMember: false,
        changeOnCheck: true,
        checkStateMappings: [
          { source: "In Progress", target: "In Review" },
          { source: "In Review", target: "Done" },
          { source: "Todo", target: "In Progress" },
          { source: "Done", target: "" }
        ],
        checkTargetStateName: "",
        completionSound: true,
        collapsedGroupKeys: [],
        alwaysOnTop: true,
        refreshMinutes: 5,
        theme,
        compactCards,
        priorityStyle,
        closeToTray: true,
        minimizeToTray: true,
        startAtLogin: false,
        setupComplete: true,
        tokenSet: true,
        tokenError: false,
        loginStartupStatus: "disabled",
        appVersion: packageVersion,
        platform: "win32",
        trayLocation: "notification area"
      };
      window.planePin = {
        getSettings: async () => ({ ...settings }),
        saveSettings: async (next) => {
          Object.assign(settings, next);
          return { persistedToken: true };
        },
        openSettingsWindow: async () => true,
        closeSettingsWindow: async () => true,
        discoverWorkspace: async () => ({
          member: { id: "94cf0210-9909-4f77-b24e-14b2988156e5", name: "Kuu" },
          members: [
            { id: "94cf0210-9909-4f77-b24e-14b2988156e5", name: "Kuu", email: "kuu@example.com" },
            { id: "84cf0210-9909-4f77-b24e-14b2988156e5", name: "Bea", email: "bea@example.com" },
            { id: "unassigned", name: "Unassigned", email: "Tasks without an assignee" }
          ],
          projects: [
            {
              id: "10918ea1-52f7-48bd-abe3-d3efe76ff7dd",
              identifier: "ENG",
              name: "Engineering",
              states: [
                { id: "state-progress", name: "In Progress", group: "started", color: "#f59e0b" },
                { id: "state-review", name: "In Review", group: "started", color: "#8b5cf6" },
                { id: "state-done", name: "Done", group: "completed", color: "#46a758" }
              ]
            },
            {
              id: "00918ea1-52f7-48bd-abe3-d3efe76ff7dd",
              identifier: "MKTG",
              name: "Marketing",
              states: [
                { id: "state-todo", name: "Todo", group: "unstarted", color: "#60646c" },
                { id: "state-done", name: "Done", group: "completed", color: "#46a758" }
              ]
            }
          ]
        }),
        setAlwaysOnTop: async (value) => value,
        setPreference: async (key, value) => value,
        minimizeWindow: async () => {},
        setWindowCompactMode: async () => false,
        toggleMaximizeWindow: async () => false,
        closeWindow: async () => {},
        startWindowDrag: async () => true,
        moveWindowBy: async () => true,
        endWindowDrag: async () => true,
        openTask: async () => {},
        changeTaskState: async (task) => ({
          stateName: "In Review",
          stateGroup: "started",
          stateColor: "#8b5cf6",
          undoToken: { taskId: task.id, previousStateId: "state-progress" }
        }),
        undoTaskState: async () => ({ stateName: "In Progress", stateGroup: "started", stateColor: "#f59e0b" }),
        celebrateAt: async () => true,
        finishCelebration: () => {},
        listTasks: async () => tasks,
        getUpdateState: async () => ({ status: "up-to-date", currentVersion: packageVersion }),
        checkForUpdates: async () => ({ status: "up-to-date", currentVersion: packageVersion }),
        installUpdate: async () => ({ status: "installing", currentVersion: packageVersion }),
        onTrayCommand: () => {},
        onUpdateState: () => {},
        onSettingsChanged: () => {}
      };
    },
    { tasks, compactCards, theme, priorityStyle, packageVersion }
  );
  await page.goto(`${page_url}${view === "settings" ? "?view=settings" : ""}`);
  await page.waitForSelector(view === "settings" ? "#settings-dialog[open]" : ".task-card");
  const horizontalOverflow = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
  );
  if (horizontalOverflow > 1) {
    throw new Error(`Renderer exceeds the viewport by ${horizontalOverflow}px.`);
  }
  return page;
}

let browser;
try {
  browser = await chromium.launch(executablePath ? { executablePath } : {});
} catch (error) {
  throw new Error(
    "No compatible browser could be launched. Install Chrome/Edge, set PLAYWRIGHT_CHROMIUM, or run `npm exec playwright install chromium`.",
    { cause: error }
  );
}
const shots = [];

for (const theme of ["light", "dark"]) {
  for (const compactCards of [false, true]) {
    const page = await open(browser, { compactCards, theme });
    const name = `${theme}-${compactCards ? "compact" : "comfortable"}.png`;
    await page.screenshot({ path: path.join(outputDir, name) });
    shots.push(name);

    if (theme === "light" && !compactCards) {
      await page.hover(".task-item");
      await page.screenshot({ path: path.join(outputDir, "light-check-hover.png") });
      shots.push("light-check-hover.png");
      await page.click(".complete-task");
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(outputDir, "light-state-transition.png") });
      shots.push("light-state-transition.png");
    }

    if (compactCards) {
      await page.click("#compact-toggle");
      await page.waitForTimeout(350);
      const railName = `${theme}-compact-rail.png`;
      await page.screenshot({ path: path.join(outputDir, railName) });
      shots.push(railName);
    }
    await page.close();
  }
}

async function captureReorderMarker(page, containerSelector, name) {
  const rows = page.locator(`${containerSelector} .selection-row`);
  if (await rows.count() < 2) throw new Error(`${containerSelector} needs two reorder rows.`);
  const handle = rows.nth(0).locator(".drag-handle");
  const target = rows.nth(1);
  await target.scrollIntoViewIfNeeded();
  const handleBox = await handle.boundingBox();
  const targetBox = await target.boundingBox();
  if (!handleBox || !targetBox) throw new Error(`Could not measure ${containerSelector}.`);
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 3, { steps: 12 });
  await page.waitForFunction(
    (selector) => document.querySelector(`${selector} .drop-before, ${selector} .drop-after`),
    containerSelector
  );
  await page.screenshot({ path: path.join(outputDir, name) });
  shots.push(name);
  await page.mouse.up();
}

const settingsPage = await open(browser, { compactCards: true, theme: "light", view: "settings" });
await settingsPage.waitForTimeout(300);
await captureReorderMarker(settingsPage, "#settings-member-options", "settings-member-reorder.png");
await captureReorderMarker(settingsPage, "#settings-project-options", "settings-project-reorder.png");
await captureReorderMarker(settingsPage, "#settings-state-options", "settings-state-reorder.png");
await settingsPage.evaluate(() => {
  document.querySelector("#settings-member-options").scrollIntoView({ block: "start" });
});
await settingsPage.waitForTimeout(200);
await settingsPage.screenshot({ path: path.join(outputDir, "settings-task-order.png") });
shots.push("settings-task-order.png");
if (!await settingsPage.isChecked("#settings-change-on-check")) {
  await settingsPage.check("#settings-change-on-check");
}
await settingsPage.evaluate(() => {
  document.querySelector(".completion-block").scrollIntoView({ block: "center" });
});
await settingsPage.waitForTimeout(200);
await settingsPage.screenshot({ path: path.join(outputDir, "settings-completion.png") });
shots.push("settings-completion.png");
await settingsPage.evaluate(() => {
  document.querySelector("#settings-close-tray").scrollIntoView({ block: "center" });
});
await settingsPage.waitForTimeout(200);
await settingsPage.screenshot({ path: path.join(outputDir, "settings-window-section.png") });
shots.push("settings-window-section.png");
await settingsPage.close();

await browser.close();
console.log(shots.join("\n"));

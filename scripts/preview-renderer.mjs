// Screenshots the renderer against a stubbed bridge so card density and the
// task-only rail can be checked without a live Plane workspace.
//
// Playwright is a review-time tool, not a dependency of the app:
//   npm i -D playwright && npx playwright install chromium
//   node scripts/preview-renderer.mjs <output-dir>
// Set PLAYWRIGHT_CHROMIUM to use a Chromium that is already on the machine.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const page_url = `file://${path.join(here, "..", "src", "renderer", "index.html")}`;
const outputDir = process.argv[2] || "/tmp/plane-pin-preview";
fs.mkdirSync(outputDir, { recursive: true });

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
  projectName,
  projectIdentifier: identifier.split("-")[0],
  targetDate: index === 0 ? "2026-08-04" : null,
  url: "https://plane.example.com/engineering/browse/" + identifier
}));

async function open(browser, { compactCards, theme }) {
  const page = await browser.newPage({ viewport: { width: 380, height: 650 } });
  await page.addInitScript(
    ({ tasks, compactCards, theme }) => {
      const settings = {
        schemaVersion: 1,
        baseUrl: "https://plane.example.com",
        workspaceSlug: "engineering",
        projectId: "",
        projectScope: "all",
        memberId: "94cf0210-9909-4f77-b24e-14b2988156e5",
        memberName: "Kuu",
        stateFilterMode: "all",
        stateNames: [],
        groupByProject: true,
        alwaysOnTop: true,
        refreshMinutes: 5,
        theme,
        compactCards,
        closeToTray: true,
        minimizeToTray: true,
        setupComplete: true,
        tokenSet: true,
        tokenError: false,
        platform: "win32",
        trayLocation: "notification area"
      };
      window.planePin = {
        getSettings: async () => ({ ...settings }),
        saveSettings: async () => ({ persistedToken: true }),
        discoverWorkspace: async () => ({ projects: [], member: null }),
        setAlwaysOnTop: async (value) => value,
        setPreference: async (key, value) => value,
        minimizeWindow: async () => {},
        toggleMaximizeWindow: async () => false,
        closeWindow: async () => {},
        startWindowDrag: async () => true,
        moveWindowBy: async () => true,
        endWindowDrag: async () => true,
        openTask: async () => {},
        listTasks: async () => tasks,
        onTrayCommand: () => {}
      };
    },
    { tasks, compactCards, theme }
  );
  await page.goto(page_url);
  await page.waitForSelector(".task-card");
  return page;
}

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const shots = [];

for (const theme of ["light", "dark"]) {
  for (const compactCards of [false, true]) {
    const page = await open(browser, { compactCards, theme });
    const name = `${theme}-${compactCards ? "compact" : "comfortable"}.png`;
    await page.screenshot({ path: path.join(outputDir, name) });
    shots.push(name);

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

const settingsPage = await open(browser, { compactCards: true, theme: "light" });
await settingsPage.setViewportSize({ width: 560, height: 760 });
await settingsPage.click("#settings-open");
await settingsPage.waitForTimeout(300);
await settingsPage.evaluate(() => {
  document.querySelector("#settings-close-tray").scrollIntoView({ block: "center" });
});
await settingsPage.waitForTimeout(200);
await settingsPage.screenshot({ path: path.join(outputDir, "settings-window-section.png") });
shots.push("settings-window-section.png");
await settingsPage.close();

await browser.close();
console.log(shots.join("\n"));

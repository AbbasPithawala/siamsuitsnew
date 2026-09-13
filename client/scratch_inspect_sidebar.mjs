import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

page.on("console", (msg) => console.log("[console]", msg.type(), msg.text()));
page.on("pageerror", (err) => console.log("[pageerror]", err.message));

await page.goto("http://localhost:5173/platform/login");
await page.waitForSelector("input[name=username], input#username, input[type=text]", { timeout: 15000 });

// Try to find username/password fields generically
const inputs = await page.$$("input");
for (const input of inputs) {
  const type = await input.getAttribute("type");
  const name = await input.getAttribute("name");
  console.log("input:", name, type);
}

await page.screenshot({ path: "C:/Users/WS/AppData/Local/Temp/claude/c--Users-WS-Desktop-abbas-projects-siam/abfe71ee-57c8-4895-8f97-3023996f4e03/scratchpad/01-login-page.png" });

await browser.close();

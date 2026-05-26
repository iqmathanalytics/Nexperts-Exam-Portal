import type { Browser } from "puppeteer-core";

/** Launch headless Chrome — bundled Puppeteer locally, @sparticuz/chromium on Render/production. */
export async function launchHeadlessBrowser(): Promise<Browser> {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    const puppeteer = await import("puppeteer-core");
    const chromium = await import("@sparticuz/chromium");

    return puppeteer.default.launch({
      args: [
        ...chromium.default.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--font-render-hinting=none",
      ],
      executablePath: await chromium.default.executablePath(),
      headless: true,
    });
  }

  const puppeteer = await import("puppeteer");
  return puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
  }) as Promise<Browser>;
}

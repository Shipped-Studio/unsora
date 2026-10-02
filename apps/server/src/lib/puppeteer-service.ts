import puppeteer, { Browser } from "puppeteer";

interface VideoSource {
  videoUrl: string;
  posterUrl?: string;
  width?: string;
  height?: string;
  type?: string;
}

class PuppeteerService {
  private browser: Browser | null = null;
  private isLaunching: boolean = false;

  async getBrowser(): Promise<Browser> {
    // If browser exists and is connected, return it
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    // If browser is being launched, wait for it
    if (this.isLaunching) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return this.getBrowser();
    }

    // Launch new browser
    this.isLaunching = true;
    try {
      console.log("🚀 Launching browser instance...");
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      });

      // Handle browser disconnection
      this.browser.on("disconnected", () => {
        console.log("🔌 Browser disconnected");
        this.browser = null;
      });

      console.log("✅ Browser instance launched");
      return this.browser;
    } finally {
      this.isLaunching = false;
    }
  }

  async extractVideoSources(pageUrl: string): Promise<VideoSource[]> {
    try {
      console.log(`🔍 Extracting video sources from: ${pageUrl}`);

      const browser = await this.getBrowser();
      const page = await browser.newPage();

      // Mask webdriver
      await page.evaluateOnNewDocument(() => {
        // @ts-ignore
        Object.defineProperty(navigator, "webdriver", {
          get: () => false,
        });
      });

      try {
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        );

        await page.setViewport({ width: 1920, height: 1080 });

        await page.goto(pageUrl, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });

        const videos = await page.evaluate(() => {
          const videoElements = document.querySelectorAll("video");
          const results: VideoSource[] = [];

          videoElements.forEach((video) => {
            // Get direct src attribute
            const src = video.getAttribute("src");
            const poster = video.getAttribute("poster");
            const width = video.getAttribute("width");
            const height = video.getAttribute("height");

            if (src) {
              results.push({
                videoUrl: src,
                posterUrl: poster || undefined,
                width: width || undefined,
                height: height || undefined,
              });
            }

            // Also check for source tags inside video element
            const sources = video.querySelectorAll("source");
            sources.forEach((source) => {
              const sourceSrc = source.getAttribute("src");
              const type = source.getAttribute("type");

              if (sourceSrc) {
                results.push({
                  videoUrl: sourceSrc,
                  posterUrl: poster || undefined,
                  type: type || undefined,
                  width: width || undefined,
                  height: height || undefined,
                });
              }
            });
          });

          return results;
        });

        console.log(`✅ Found ${videos.length} video source(s)`);
        return videos;
      } finally {
        // Always close the page to free up resources
        await page.close();
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error("❌ Error extracting videos:", error.message);
      } else {
        console.error("❌ Error:", error);
      }
      return [];
    }
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      console.log("🔒 Closing browser instance...");
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Export singleton instance
export const puppeteerService = new PuppeteerService();

// Graceful shutdown
process.on("SIGINT", async () => {
  await puppeteerService.closeBrowser();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await puppeteerService.closeBrowser();
  process.exit(0);
});

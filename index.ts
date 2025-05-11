import * as puppeteer from "puppeteer";
import * as http from "http";
import * as url from "url";
import * as path from "path";

const EXTENSION_PATH = path.join(__dirname, "extension");
const EXTENSION_ID = "lkbebcjgcmobigpeffafkodonchffocl";
const TIMEOUT_DURATION_SECONDS = 60;

let browser: puppeteer.Browser | null = null;

async function initializeBrowser() {  
  try {
    browser = await puppeteer.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--single-process",
        "--no-zygote",
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
      executablePath: "/usr/bin/google-chrome-stable",
      timeout: 120000,
    });
    return browser;
  } catch (error) {
    throw error;
  }
}

async function configureExtension(
  pageForConfig: puppeteer.Page,
  extensionId: string
) {
  try {
    const optionsPageUrl = `chrome-extension://${extensionId}/options/options.html`;
    await pageForConfig.goto(optionsPageUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await pageForConfig.click("#save_top");
    const optInUrl = `chrome-extension://${extensionId}/options/optin/opt-in.html`;
    await pageForConfig.goto(optInUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await pageForConfig.click("#optin-enable");
  } catch (error) {
    throw error;
  }
}

async function generatePDF(url: string, page: puppeteer.Page) {
  const targetUrl = decodeURIComponent(url);
  console.log(`Navigating to ${targetUrl}`);

  try {
    await page.goto(targetUrl, {
      waitUntil: "networkidle2",
      timeout: TIMEOUT_DURATION_SECONDS * 1000,
    });
    console.log(`Navigation to ${targetUrl} successful`);
  } catch (error) {
    console.error(
      `Navigation to ${targetUrl} timed out after ${TIMEOUT_DURATION_SECONDS} seconds:`,
      error
    );
    throw new Error(
      `Navigation timed out after ${TIMEOUT_DURATION_SECONDS} seconds`
    );
  }

  try {
    let pdfBuffer = await page.pdf({
      format: "A4",
      margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" },
      printBackground: true,
      timeout: TIMEOUT_DURATION_SECONDS * 1000,
    });
    console.log("PDF generated successfully");
    return pdfBuffer;
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  let page: puppeteer.Page | null = null;
  
  try {
    await initializeBrowser();
    if (!browser) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Browser initialization failed" }));
      return;
    }

    const tempPage = await browser.newPage();
    await configureExtension(tempPage, EXTENSION_ID);
    await tempPage.close();

    const { pathname, query } = url.parse(req.url || "", true);
    const path = pathname || "";
    const method = req.method || "";

    if (path === "/" && method === "GET") {
      const targetUrl = query.url;

      if (!targetUrl) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "URL parameter is required" }));
        return;
      }

      try {
        page = await browser.newPage();
        await page.setJavaScriptEnabled(true);
        await page.setViewport({ width: 375, height: 667 });
        await page.setUserAgent(
          "Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1"
        );
        await page.setCacheEnabled(false);

        const pdfBuffer = await generatePDF(targetUrl.toString(), page);

        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Length": pdfBuffer.length,
          "Content-Disposition": "attachment; filename=article.pdf",
        });
        res.end(pdfBuffer);
      } catch (error: any) {
        console.error("Error handling request:", error);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ error: `PDF generation failed: ${error.message}` })
          );
        }
      }
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found\n");
    }
  } catch (error: any) {
    console.error("Server error:", error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Server error: ${error.message}` }));
    }
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (err) {
        console.error("Error closing page:", err);
      }
    }
    
    if (browser) {
      try {
        await browser.close();
      } catch (err) {
        console.error("Error closing browser:", err);
      }
      browser = null;
    }
  }
});

server.listen(3000, '0.0.0.0');
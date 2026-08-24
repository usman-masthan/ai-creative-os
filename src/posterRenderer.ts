import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export interface PosterRenderRequest {
  htmlPath: string;
  outputPath: string;
  width: number;
  height: number;
  chromePath?: string;
}

const chromeCandidates = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function resolveChromePath(explicitPath?: string): Promise<string> {
  if (explicitPath?.trim()) {
    if (!(await exists(explicitPath))) {
      throw new Error(`Chrome executable not found at CHROME_PATH: ${explicitPath}`);
    }
    return explicitPath;
  }

  for (const candidate of chromeCandidates) {
    if (await exists(candidate)) return candidate;
  }

  throw new Error(
    "No Chrome/Chromium executable found. Set CHROME_PATH to a local Chrome or Chromium binary.",
  );
}

export async function renderPosterPng(request: PosterRenderRequest): Promise<void> {
  const chrome = await resolveChromePath(request.chromePath);
  const pageUrl = pathToFileURL(request.htmlPath).href;

  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--run-all-compositor-stages-before-draw",
    `--window-size=${request.width},${request.height}`,
    `--screenshot=${request.outputPath}`,
    pageUrl,
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(chrome, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Headless Chrome poster render failed with exit code ${String(code)}${stderr ? `: ${stderr.trim()}` : ""}`,
        ),
      );
    });
  });
}

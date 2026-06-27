import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";

const APP_VERSION_FALLBACK = "0.1.0";
const GITHUB_RELEASES_URL = "https://github.com/glosc-ai/Glosc-Chat/releases";
const GITHUB_LATEST_RELEASE_API = "https://api.github.com/repos/glosc-ai/Glosc-Chat/releases/latest";
const UPDATE_CHECK_TIMEOUT_MS = 15_000;
const UPDATE_DOWNLOAD_TIMEOUT_MS = 180_000;

export type AppUpdateCheckResult =
  | {
      status: "up-to-date";
      currentVersion: string;
    }
  | AppUpdateAvailable;

export type AppUpdateAvailable =
  | {
      status: "available";
      source: "desktop-updater";
      currentVersion: string;
      version: string;
      date?: string;
      notes?: string;
      update: Update;
    }
  | {
      status: "available";
      source: "github-release";
      currentVersion: string;
      version: string;
      date?: string;
      notes?: string;
      downloadUrl: string;
      releaseUrl: string;
      assetName?: string;
    };

interface GithubRelease {
  tag_name?: string;
  name?: string;
  body?: string | null;
  html_url?: string;
  published_at?: string;
  assets?: GithubReleaseAsset[];
}

interface GithubReleaseAsset {
  name: string;
  browser_download_url?: string;
}

export async function getCurrentAppVersion(): Promise<string> {
  if (!isTauri()) return APP_VERSION_FALLBACK;

  try {
    return await getVersion();
  } catch {
    return APP_VERSION_FALLBACK;
  }
}

export async function checkForAppUpdate(): Promise<AppUpdateCheckResult> {
  const currentVersion = await getCurrentAppVersion();

  if (isTauri() && !isMobileRuntime()) {
    const update = await check({ timeout: UPDATE_CHECK_TIMEOUT_MS });
    if (!update) {
      return { status: "up-to-date", currentVersion };
    }

    return {
      status: "available",
      source: "desktop-updater",
      currentVersion: update.currentVersion || currentVersion,
      version: update.version,
      date: update.date,
      notes: update.body,
      update,
    };
  }

  const release = await fetchLatestGithubRelease();
  const version = normalizeVersion(release.tag_name ?? release.name ?? "");
  if (!version || compareVersions(version, currentVersion) <= 0) {
    return { status: "up-to-date", currentVersion };
  }

  const androidAsset = isAndroidRuntime() ? findAndroidApkAsset(release.assets ?? []) : undefined;
  const releaseUrl = release.html_url ?? GITHUB_RELEASES_URL;

  return {
    status: "available",
    source: "github-release",
    currentVersion,
    version,
    date: release.published_at,
    notes: release.body ?? undefined,
    downloadUrl: androidAsset?.browser_download_url ?? releaseUrl,
    releaseUrl,
    assetName: androidAsset?.name,
  };
}

export async function installDesktopUpdate(
  update: Extract<AppUpdateAvailable, { source: "desktop-updater" }>,
  onEvent?: (event: DownloadEvent) => void,
): Promise<void> {
  try {
    await update.update.downloadAndInstall(onEvent, { timeout: UPDATE_DOWNLOAD_TIMEOUT_MS });
  } finally {
    await update.update.close().catch(() => undefined);
  }

  await relaunch();
}

function isMobileRuntime(): boolean {
  return isAndroidRuntime() || /iPad|iPhone|iPod/i.test(navigator.userAgent);
}

function isAndroidRuntime(): boolean {
  return /Android/i.test(navigator.userAgent);
}

async function fetchLatestGithubRelease(): Promise<GithubRelease> {
  const response = await fetch(GITHUB_LATEST_RELEASE_API, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub Releases 检查失败：HTTP ${response.status}`);
  }

  return (await response.json()) as GithubRelease;
}

function findAndroidApkAsset(assets: GithubReleaseAsset[]): GithubReleaseAsset | undefined {
  const apkAssets = assets.filter((asset) => /\.apk$/i.test(asset.name) && asset.browser_download_url);
  return (
    apkAssets.find((asset) => /release/i.test(asset.name) && !/debug/i.test(asset.name)) ??
    apkAssets.find((asset) => !/debug/i.test(asset.name)) ??
    apkAssets[0]
  );
}

function normalizeVersion(value: string): string {
  return value.trim().replace(/^v/i, "").split("+")[0];
}

function compareVersions(left: string, right: string): number {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);

  for (let index = 0; index < 3; index += 1) {
    const difference = leftVersion.numbers[index] - rightVersion.numbers[index];
    if (difference !== 0) return difference;
  }

  if (leftVersion.prerelease === rightVersion.prerelease) return 0;
  if (!leftVersion.prerelease) return 1;
  if (!rightVersion.prerelease) return -1;
  return leftVersion.prerelease.localeCompare(rightVersion.prerelease);
}

function parseVersion(value: string): { numbers: [number, number, number]; prerelease: string } {
  const [core, prerelease = ""] = normalizeVersion(value).split("-", 2);
  const numbers = core.split(".").map((part) => Number.parseInt(part, 10));

  return [
    Number.isFinite(numbers[0]) ? numbers[0] : 0,
    Number.isFinite(numbers[1]) ? numbers[1] : 0,
    Number.isFinite(numbers[2]) ? numbers[2] : 0,
  ].reduce(
    (version, number, index) => {
      version.numbers[index] = number;
      return version;
    },
    { numbers: [0, 0, 0] as [number, number, number], prerelease },
  );
}

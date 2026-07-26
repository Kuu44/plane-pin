"use strict";

function createUpdateManager({
  updater,
  currentVersion,
  supported,
  unsupportedMessage,
  beforeInstall = () => {},
  notify = () => {},
  defer = queueMicrotask
}) {
  let installAfterDownload = false;
  let state = {
    status: supported ? "idle" : "unavailable",
    currentVersion,
    availableVersion: "",
    progress: 0,
    error: "",
    message: supported ? "" : unsupportedMessage
  };

  function publish(patch) {
    state = { ...state, ...patch };
    notify({ ...state });
    return { ...state };
  }

  function fail(error) {
    return publish({
      status: "error",
      progress: 0,
      error: String(error?.message || error || "Update failed."),
      message: ""
    });
  }

  function installDownloadedUpdate() {
    publish({ status: "installing", progress: 100, error: "", message: "" });
    beforeInstall();
    updater.quitAndInstall(true, true);
  }

  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;

  updater.on("checking-for-update", () => publish({
    status: "checking",
    progress: 0,
    error: "",
    message: ""
  }));
  updater.on("update-available", (info) => publish({
    status: "available",
    availableVersion: String(info?.version || ""),
    progress: 0,
    error: "",
    message: ""
  }));
  updater.on("update-not-available", () => publish({
    status: "up-to-date",
    availableVersion: "",
    progress: 0,
    error: "",
    message: ""
  }));
  updater.on("download-progress", (progress) => publish({
    status: "downloading",
    progress: Math.max(0, Math.min(100, Number(progress?.percent) || 0)),
    error: "",
    message: ""
  }));
  updater.on("update-downloaded", (info) => {
    publish({
      status: "ready",
      availableVersion: String(info?.version || state.availableVersion),
      progress: 100,
      error: "",
      message: ""
    });
    if (installAfterDownload) defer(installDownloadedUpdate);
  });
  updater.on("error", fail);

  async function check() {
    if (!supported) return publish({ status: "unavailable", message: unsupportedMessage });
    if (state.status === "checking" || state.status === "downloading" || state.status === "installing") {
      return { ...state };
    }
    try {
      publish({ status: "checking", progress: 0, error: "", message: "" });
      await updater.checkForUpdates();
    } catch (error) {
      fail(error);
    }
    return { ...state };
  }

  async function install() {
    if (state.status === "ready") {
      installDownloadedUpdate();
      return { ...state };
    }
    if (state.status !== "available") {
      await check();
      if (state.status !== "available") return { ...state };
    }
    installAfterDownload = true;
    publish({ status: "downloading", progress: 0, error: "", message: "" });
    try {
      await updater.downloadUpdate();
    } catch (error) {
      installAfterDownload = false;
      fail(error);
    }
    return { ...state };
  }

  return {
    check,
    getState: () => ({ ...state }),
    install
  };
}

module.exports = { createUpdateManager };

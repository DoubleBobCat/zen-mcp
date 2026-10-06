const DEFAULT_BRIDGE_SETTINGS = {
  url: "ws://localhost:9222?type=extension",
  reconnectInterval: 5000,
  autoConnect: true,
};
const DEFAULT_FILTER_NETWORK_COOKIES = true;

const urlInput = document.getElementById("url");
const reconnectIntervalInput = document.getElementById("reconnectInterval");
const autoConnectInput = document.getElementById("autoConnect");
const filterNetworkCookiesInput = document.getElementById("filterNetworkCookies");
const statusDisplay = document.getElementById("status");
const saveButton = document.getElementById("save");

function normalizeBridgeSettings(value = {}) {
  const settings = { ...DEFAULT_BRIDGE_SETTINGS, ...value };
  const urlText = String(settings.url).trim();
  const url = new URL(urlText);

  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error("Bridge URL must use ws: or wss:");
  }

  const reconnectInterval = Number(settings.reconnectInterval);
  if (!Number.isFinite(reconnectInterval) || reconnectInterval < 500) {
    throw new Error("Reconnect interval must be at least 500 ms");
  }

  if (typeof settings.autoConnect !== "boolean") {
    throw new Error("Auto connect must be true or false");
  }

  return {
    url: urlText,
    reconnectInterval,
    autoConnect: settings.autoConnect,
  };
}

function renderSettings(settings) {
  urlInput.value = settings.url;
  reconnectIntervalInput.value = String(settings.reconnectInterval);
  autoConnectInput.checked = settings.autoConnect;
  filterNetworkCookiesInput.checked = settings.filterNetworkCookies !== false;
}

function renderStatus(status) {
  statusDisplay.textContent = `Status: ${status ?? "unknown"}`;
}

async function loadSettings() {
  const result = await browser.storage.local.get(["bridgeSettings", "bridgeStatus", "filterNetworkCookies"]);
  const settings = normalizeBridgeSettings(result.bridgeSettings ?? {});
  settings.filterNetworkCookies = result.filterNetworkCookies !== false;
  renderSettings(settings);
  renderStatus(result.bridgeStatus);
}

async function saveSettings() {
  try {
    const settings = normalizeBridgeSettings({
      url: urlInput.value,
      reconnectInterval: reconnectIntervalInput.value,
      autoConnect: autoConnectInput.checked,
    });
    settings.filterNetworkCookies = filterNetworkCookiesInput.checked;

    await browser.storage.local.set({ bridgeSettings: settings, filterNetworkCookies: filterNetworkCookiesInput.checked });
    renderSettings(settings);
    renderStatus("saved");
  } catch (error) {
    renderStatus(`error: ${error.message}`);
  }
}

saveButton.addEventListener("click", saveSettings);
loadSettings().catch((error) => {
  renderSettings(DEFAULT_BRIDGE_SETTINGS);
  renderStatus(`error: ${error}`);
});

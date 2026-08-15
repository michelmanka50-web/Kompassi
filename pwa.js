let deferredInstallPrompt = null;

function updateInstallButtons(available) {
  document.querySelectorAll("[data-install-app]").forEach((button) => {
    button.hidden = !available;
  });
}

if ("serviceWorker" in navigator && ["http:", "https:"].includes(window.location.protocol)) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallButtons(true);
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  updateInstallButtons(false);
});

document.querySelectorAll("[data-install-app]").forEach((button) => {
  button.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    updateInstallButtons(false);
  });
});

updateInstallButtons(Boolean(deferredInstallPrompt));

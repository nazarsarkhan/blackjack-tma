const tg = window.Telegram?.WebApp;

export function initTelegramApp() {
  if (!tg) {
    return null;
  }

  tg.expand();
  tg.ready();
  tg.enableClosingConfirmation();
  tg.setHeaderColor("#0d3b2a");
  tg.setBackgroundColor("#072319");

  document.documentElement.style.setProperty("--tg-color-scheme", tg.colorScheme ?? "dark");

  return tg;
}

export function bindViewportCssVars() {
  const root = document.documentElement;

  if (!tg) {
    root.style.setProperty("--tg-viewport-height", `${window.innerHeight}px`);
    root.style.setProperty("--tg-viewport-stable-height", `${window.innerHeight}px`);
    root.style.setProperty("--tg-color-scheme", "standalone");
    return () => {};
  }

  const applyViewport = () => {
    const viewportHeight = tg.viewportHeight || window.innerHeight;
    const stableHeight = tg.viewportStableHeight || viewportHeight;
    root.style.setProperty("--tg-viewport-height", `${viewportHeight}px`);
    root.style.setProperty("--tg-viewport-stable-height", `${stableHeight}px`);
    root.style.setProperty("--tg-color-scheme", tg.colorScheme ?? "dark");
  };

  applyViewport();
  tg.onEvent?.("viewportChanged", applyViewport);
  tg.onEvent?.("themeChanged", applyViewport);

  return () => {
    tg.offEvent?.("viewportChanged", applyViewport);
    tg.offEvent?.("themeChanged", applyViewport);
  };
}

export function getTelegramContext() {
  if (!tg) {
    return {
      isTelegram: false,
      user: null,
      theme: "standalone"
    };
  }

  return {
    isTelegram: true,
    user: tg.initDataUnsafe?.user ?? null,
    theme: tg.colorScheme ?? "unknown",
    startParam: tg.initDataUnsafe?.start_param ?? null
  };
}

export function setupMainButton({ text, onClick, visible = true, active = true }) {
  if (!tg?.MainButton) {
    return () => {};
  }

  tg.MainButton.setParams({
    text,
    is_visible: visible,
    is_active: active,
    color: "#e0b15b",
    text_color: "#10261c"
  });

  if (visible) {
    tg.MainButton.show();
  } else {
    tg.MainButton.hide();
  }

  if (onClick) {
    tg.MainButton.onClick(onClick);
  }

  return () => {
    if (onClick) {
      tg.MainButton.offClick(onClick);
    }
  };
}

export function haptic(type = "impact", style = "light") {
  tg?.HapticFeedback?.[type]?.(style);
}

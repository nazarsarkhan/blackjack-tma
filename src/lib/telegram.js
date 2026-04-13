const tg = window.Telegram?.WebApp;

export function initTelegramApp() {
  if (!tg) {
    return null;
  }

  tg.ready();
  tg.expand();
  tg.enableClosingConfirmation();
  tg.setHeaderColor("#0d3b2a");
  tg.setBackgroundColor("#072319");

  return tg;
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
    theme: tg.colorScheme ?? "unknown"
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

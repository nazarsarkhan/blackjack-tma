const LANGUAGE_FLAGS = {
  ru: "RU",
  en: "EN",
  ar: "AR",
  es: "ES",
  pt: "PT",
  tr: "TR",
  fa: "FA",
  hi: "HI",
  zh: "ZH"
};

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(value ?? 0);
}

function formatRemaining(ms) {
  if (ms <= 0) {
    return "00:00:00";
  }

  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export default function LobbyScreen({
  copy,
  activeTable,
  onTableChange,
  leaderboard,
  dailyBonus,
  onClaimBonus,
  referralLink,
  onCopyReferral,
  achievements,
  languages,
  activeLanguage,
  onLanguageChange,
  customization,
  onCustomizationChange,
  packages,
  onOpenShop
}) {
  return (
    <section className="lobby-screen">
      <div className="lobby-hero">
        <div>
          <span className="eyebrow">{copy.lobbyEyebrow}</span>
          <h1>Blackjack Royale</h1>
          <p>{copy.lobbySubtitle}</p>
        </div>
        <button type="button" className="shop-trigger" onClick={onOpenShop}>
          {copy.shop}
        </button>
      </div>

      <div className="table-selector">
        {[
          { id: "free", title: copy.tableFree, note: "Fun table" },
          { id: "real", title: copy.tableReal, note: "Cash balance" },
          { id: "vip", title: copy.tableVip, note: "High roller" }
        ].map((table) => (
          <button
            key={table.id}
            type="button"
            className={activeTable === table.id ? "selector-card active" : "selector-card"}
            onClick={() => onTableChange(table.id)}
          >
            <strong>{table.title}</strong>
            <span>{table.note}</span>
          </button>
        ))}
      </div>

      <div className="lobby-grid">
        <article className="lobby-card">
          <div className="card-heading">
            <strong>{copy.leaderboard}</strong>
            <span>Top 5</span>
          </div>
          <div className="leaderboard-list">
            {leaderboard.map((entry, index) => (
              <div key={`${entry.userId ?? entry.telegramId ?? index}-${index}`} className="leader-row">
                <span>#{index + 1}</span>
                <strong>{entry.displayName ?? entry.username ?? "Player"}</strong>
                <b>{formatNumber(entry.points ?? entry.netResult ?? 0)}</b>
              </div>
            ))}
          </div>
        </article>

        <article className="lobby-card bonus-card">
          <div className="card-heading">
            <strong>{copy.dailyBonus}</strong>
            <span>{copy.dailyTimer}</span>
          </div>
          <div className="bonus-timer">{dailyBonus.available ? copy.claimNow : formatRemaining(dailyBonus.remainingMs)}</div>
          <button type="button" className="gold-button" disabled={!dailyBonus.available} onClick={onClaimBonus}>
            {dailyBonus.available ? copy.claimBonus : copy.locked}
          </button>
        </article>

        <article className="lobby-card">
          <div className="card-heading">
            <strong>{copy.referral}</strong>
            <span>{copy.copyLink}</span>
          </div>
          <p className="referral-link">{referralLink}</p>
          <button type="button" className="secondary-button" onClick={onCopyReferral}>
            {copy.copyLink}
          </button>
        </article>

        <article className="lobby-card">
          <div className="card-heading">
            <strong>{copy.achievements}</strong>
            <span>{copy.latest}</span>
          </div>
          <div className="achievement-list">
            {achievements.length ? (
              achievements.map((achievement, index) => (
                <div key={`${achievement.id ?? achievement.code ?? index}-${index}`} className="achievement-item">
                  <strong>{achievement.title ?? achievement.name ?? "Royal streak"}</strong>
                  <span>{achievement.description ?? achievement.unlockedAt ?? "Unlocked at the table"}</span>
                </div>
              ))
            ) : (
              <div className="achievement-item">
                <strong>{copy.noAchievements}</strong>
                <span>{copy.playToUnlock}</span>
              </div>
            )}
          </div>
        </article>

        <article className="lobby-card">
          <div className="card-heading">
            <strong>{copy.language}</strong>
            <span>{activeLanguage.toUpperCase()}</span>
          </div>
          <div className="language-grid">
            {languages.map((language) => (
              <button
                key={language}
                type="button"
                className={activeLanguage === language ? "language-pill active" : "language-pill"}
                onClick={() => onLanguageChange(language)}
              >
                {LANGUAGE_FLAGS[language] ?? language.toUpperCase()}
              </button>
            ))}
          </div>
        </article>

        <article className="lobby-card">
          <div className="card-heading">
            <strong>{copy.customization}</strong>
            <span>{copy.savedLocal}</span>
          </div>
          <div className="swatch-group">
            {customization.tableOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={customization.tableColor === option.id ? "swatch active" : "swatch"}
                style={{ "--swatch": option.value }}
                onClick={() => onCustomizationChange({ tableColor: option.id })}
                aria-label={option.label}
              />
            ))}
          </div>
          <div className="back-grid">
            {customization.cardBackOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={customization.cardBack === option.id ? "back-preview active" : "back-preview"}
                data-variant={option.id}
                onClick={() => onCustomizationChange({ cardBack: option.id })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </article>

        <article className="lobby-card shop-preview">
          <div className="card-heading">
            <strong>{copy.shop}</strong>
            <span>{copy.chipStore}</span>
          </div>
          <div className="package-list">
            {packages.slice(0, 3).map((pack) => (
              <div key={pack.id} className="package-row">
                <strong>{pack.title}</strong>
                <span>{formatNumber(pack.chips)} chips</span>
              </div>
            ))}
          </div>
          <button type="button" className="gold-button" onClick={onOpenShop}>
            {copy.openShop}
          </button>
        </article>
      </div>
    </section>
  );
}

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(value ?? 0);
}

export default function ProfileScreen({ player, stats, referral, copy }) {
  return (
    <section className="profile-screen">
      <article className="profile-card-panel">
        <span>{copy.profile}</span>
        <strong>{player?.firstName ?? player?.username ?? "Player"}</strong>
        <b>@{player?.username ?? "guest"}</b>
      </article>

      <article className="profile-stats-grid">
        <div className="profile-stat">
          <span>{copy.games}</span>
          <strong>{formatNumber(stats?.gamesPlayed)}</strong>
        </div>
        <div className="profile-stat">
          <span>{copy.wins}</span>
          <strong>{formatNumber(stats?.wins)}</strong>
        </div>
        <div className="profile-stat">
          <span>{copy.blackjacks}</span>
          <strong>{formatNumber(stats?.blackjacks)}</strong>
        </div>
        <div className="profile-stat">
          <span>{copy.totalWagered}</span>
          <strong>{formatNumber(stats?.totalWagered)}</strong>
        </div>
      </article>

      <article className="profile-card-panel">
        <span>{copy.referral}</span>
        <strong>{referral?.referralCode ?? "—"}</strong>
        <b>{formatNumber(referral?.earnedChips)} chips</b>
      </article>
    </section>
  );
}

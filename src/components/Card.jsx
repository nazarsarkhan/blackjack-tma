import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

const suitMap = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠"
};

export default function Card({ card, index = 0, compact = false }) {
  const { t } = useTranslation();
  const suit = suitMap[card.suit] ?? card.suit ?? "";
  const rank = card.rank ?? card.value ?? "";
  const isRed = suit === "♥" || suit === "♦";

  return (
    <motion.div
      className={`card ${compact ? "card-compact" : ""} ${card.hidden ? "card-hidden" : ""}`}
      initial={{ opacity: 0, y: -26, rotate: -9, scale: 0.88 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 24, delay: index * 0.05 }}
    >
      {card.hidden ? (
        <div className="card-back-pattern" aria-label={t("table.cards")} />
      ) : (
        <>
          <div className={`card-corner ${isRed ? "red" : ""}`}>
            <span>{rank}</span>
            <span>{suit}</span>
          </div>
          <div className={`card-center ${isRed ? "red" : ""}`}>{suit}</div>
          <div className={`card-corner mirrored ${isRed ? "red" : ""}`}>
            <span>{rank}</span>
            <span>{suit}</span>
          </div>
        </>
      )}
    </motion.div>
  );
}

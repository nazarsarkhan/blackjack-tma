import { motion } from "framer-motion";

const suitMap = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠"
};

export default function Card({ card, index = 0, compact = false }) {
  const suit = suitMap[card?.suit] ?? card?.suit ?? "";
  const rank = card?.rank ?? card?.value ?? "";
  const isRed = suit === "♥" || suit === "♦";

  return (
    <motion.div
      className={`playing-card ${compact ? "compact" : ""} ${card?.hidden ? "hidden" : ""}`}
      initial={{ opacity: 0, y: 10, rotate: -4, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
    >
      {card?.hidden ? (
        <div className="card-back" aria-hidden="true" />
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

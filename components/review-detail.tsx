"use client";
import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Brand, Review } from "@/lib/data/types";
export type CardOrigin = {
  left: number;
  top: number;
  width: number;
  height: number;
};
const human = (s: string) => s.replaceAll("_", " ");
const money = (n: number | null) =>
  n === null ? "Not shared" : "₹" + n.toLocaleString("en-IN");
export function ReviewDetail({
  review: r,
  brand: b,
  origin,
  onClose,
  onChoose,
}: {
  review: Review;
  brand: Brand;
  origin: CardOrigin;
  onClose: () => void;
  onChoose?: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current
      ?.querySelector<HTMLButtonElement>("button")
      ?.focus({ preventScroll: true });
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]),a[href],input,select,textarea",
        );
        if (nodes?.length) {
          const first = nodes[0],
            last = nodes[nodes.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handler, true);
      previous?.focus();
    };
  }, [onClose]);
  const width = Math.min(760, window.innerWidth - 32);
  const initial = reduce
    ? { opacity: 0 }
    : {
        opacity: 0.25,
        x: origin.left + origin.width / 2 - window.innerWidth / 2,
        y: origin.top + origin.height / 2 - window.innerHeight / 2,
        scale: Math.min(1, origin.width / width),
        borderRadius: 24,
      };
  return (
    <motion.div
      className="review-focus-backdrop"
      initial={{
        backgroundColor: "rgba(6,17,15,0)",
        backdropFilter: "blur(0px)",
      }}
      animate={{
        backgroundColor: "rgba(6,17,15,.64)",
        backdropFilter: "blur(12px)",
      }}
      exit={{ backgroundColor: "rgba(6,17,15,0)", backdropFilter: "blur(0px)" }}
      transition={{ duration: reduce ? 0 : 0.25 }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <motion.article
        ref={ref}
        className="review-focus"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`review-title-${r.id}`}
        initial={initial}
        animate={{ opacity: 1, x: 0, y: 0, scale: 1, borderRadius: 30 }}
        exit={reduce ? { opacity: 0 } : { ...initial, opacity: 0 }}
        transition={
          reduce
            ? { duration: 0 }
            : { type: "spring", stiffness: 270, damping: 29, mass: 0.85 }
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="review-focus-top">
          <span>Inside the collaboration</span>
          <button
            className="review-focus-close"
            aria-label="Close review"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="review-focus-brand">
          <span style={{ background: b.color }}>
            {b.name
              .split(" ")
              .map((s) => s[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div>
            <h2 id={`review-title-${r.id}`}>{b.name}</h2>
            <p>
              {b.demo ? "Fictional demo brand" : b.category} · {r.collab_month}
            </p>
          </div>
          <span
            className={
              "semantic-badge " + (r.would_work_again ? "good" : "caution")
            }
          >
            {r.would_work_again ? "Would work again" : "Wouldn’t repeat"}
          </span>
        </div>
        <div className="review-focus-summary">
          <div>
            <small>Agreed collaboration</small>
            <strong>{money(r.cash_amount_inr)}</strong>
            <span>{human(r.deal_type)}</span>
          </div>
          <div>
            <small>Payment outcome</small>
            <strong
              className={r.payment_status === "never_paid" ? "bad-text" : ""}
            >
              {human(r.payment_status)}
            </strong>
            <span>
              {r.days_to_payment === null
                ? "No payment timeline reported"
                : `${r.days_to_payment} days after delivery`}
            </span>
          </div>
        </div>
        <section className="review-story">
          <h3>The creator’s experience</h3>
          {r.body ? (
            r.body.split("\n\n").map((p, i) => <p key={i}>{p}</p>)
          ) : (
            <p>
              This creator shared the structured details below without adding a
              written note.
            </p>
          )}
          <div className="review-focus-identity">
            <span>◇ Anonymous creator</span>
            <span>
              {r.follower_band.replaceAll("_", "–")} followers · {r.category}
            </span>
            {r.proof_status === "verified" && (
              <span>✓ Receipts verified{r.demo ? " · demo" : ""}</span>
            )}
          </div>
        </section>
        <div className="review-detail-columns">
          <section>
            <h3>What was delivered</h3>
            {Object.entries(r.deliverables)
              .filter(([, count]) => count > 0)
              .map(([key, count]) => (
                <div className="review-detail-row" key={key}>
                  <span>{human(key)}</span>
                  <b>{count}</b>
                </div>
              ))}
            <div className="review-detail-row">
              <span>Initial cash offer</span>
              <b>{money(r.initial_offer_inr)}</b>
            </div>
            <div className="review-detail-row">
              <span>Final agreed amount</span>
              <b>{money(r.final_amount_inr)}</b>
            </div>
            {r.product_actual_value_inr !== null && (
              <div className="review-detail-row">
                <span>Actual product value</span>
                <b>{money(r.product_actual_value_inr)}</b>
              </div>
            )}
          </section>
          <section>
            <h3>How it felt to work together</h3>
            {[
              ["Communication", r.rating_communication],
              ["Professionalism", r.rating_professionalism],
              ["Payment", r.rating_payment],
            ].map(([label, value]) => (
              <div className="review-score-row" key={label}>
                <div>
                  <span>{label}</span>
                  <b>{value}/5</b>
                </div>
                <div className="review-score-track">
                  <i style={{ width: `${(Number(value) / 5) * 100}%` }} />
                </div>
              </div>
            ))}
          </section>
        </div>
        <section className="review-rights">
          <h3>The details worth asking about</h3>
          <div>
            {[
              ["Written agreement", r.had_written_agreement ? "Yes" : "No"],
              ["Revision rounds", String(r.revisions_requested)],
              ["Scope increased", r.scope_creep ? "Yes" : "No"],
              [
                "Usage rights requested",
                r.usage_rights_requested ? "Yes" : "No",
              ],
              [
                "Usage paid separately",
                r.usage_rights_paid_separately ? "Yes" : "No",
              ],
              [
                "Unpaid ad usage",
                r.ran_as_paid_ad_without_payment ? "Reported" : "Not reported",
              ],
              [
                "Communication stopped",
                r.ghost_stage === "none" ? "No" : human(r.ghost_stage),
              ],
            ].map(([label, value]) => (
              <div className="review-detail-row" key={label}>
                <span>{label}</span>
                <b>{value}</b>
              </div>
            ))}
          </div>
        </section>
        {r.reply && (
          <section className="review-official">
            <span>Official brand response{r.demo ? " · demo" : ""}</span>
            <p>{r.reply}</p>
          </section>
        )}
        <div className="review-focus-bottom">
          <span>First-hand experiences. Identities stay private.</span>
          {onChoose && (
            <button
              className="outline-button"
              onClick={() => {
                onClose();
                onChoose();
              }}
            >
              View brand profile ↗
            </button>
          )}
        </div>
      </motion.article>
    </motion.div>
  );
}

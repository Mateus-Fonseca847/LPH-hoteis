"use client";

import { useEffect, useState } from "react";

type HotelPageActionsProps = {
  hotelName: string;
  slug: string;
};

const STORAGE_KEY = "lph-saved-hotels";

function getSavedHotels() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function HotelPageActions({ hotelName, slug }: HotelPageActionsProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setIsSaved(getSavedHotels().includes(slug));
  }, [slug]);

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";

    try {
      if (navigator.share) {
        await navigator.share({
          title: hotelName,
          text: `Confira o perfil do ${hotelName} na LPH.`,
          url,
        });
        return;
      }

      await navigator.clipboard.writeText(url);
      setFeedback("Link copiado.");
      window.setTimeout(() => setFeedback(""), 2200);
    } catch {
      setFeedback("Não foi possível compartilhar agora.");
      window.setTimeout(() => setFeedback(""), 2200);
    }
  }

  function handleSave() {
    const current = getSavedHotels();
    const next = current.includes(slug)
      ? current.filter((item) => item !== slug)
      : [...current, slug];

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setIsSaved(next.includes(slug));
    setFeedback(next.includes(slug) ? "Hotel salvo." : "Hotel removido dos salvos.");
    window.setTimeout(() => setFeedback(""), 2200);
  }

  return (
    <div className="hotel-utility-actions">
      <button type="button" className="hotel-utility-button" onClick={handleShare}>
        Compartilhar
      </button>
      <button type="button" className="hotel-utility-button" onClick={handleSave}>
        {isSaved ? "Salvo" : "Salvar"}
      </button>
      {feedback ? <span className="hotel-utility-feedback">{feedback}</span> : null}
    </div>
  );
}

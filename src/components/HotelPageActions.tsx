"use client";

import { useEffect, useState } from "react";

import {
  isHotelFavorited,
  subscribeToFavoriteHotels,
  toggleFavoriteHotel,
  type FavoriteHotel,
} from "@/lib/hotel-favorites";

type HotelPageActionsProps = {
  hotel: FavoriteHotel;
};

export function HotelPageActions({ hotel }: HotelPageActionsProps) {
  const [isSaved, setIsSaved] = useState(() => isHotelFavorited(hotel.slug));
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const syncSavedState = () => {
      setIsSaved(isHotelFavorited(hotel.slug));
    };

    syncSavedState();
    return subscribeToFavoriteHotels(syncSavedState);
  }, [hotel.slug]);

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";

    try {
      if (navigator.share) {
        await navigator.share({
          title: hotel.name,
          text: `Confira o perfil do ${hotel.name} na LPH.`,
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
    const next = toggleFavoriteHotel(hotel);

    setIsSaved(next.isFavorited);
    setFeedback(next.isFavorited ? "Hotel favoritado." : "Hotel removido dos favoritos.");
    window.setTimeout(() => setFeedback(""), 2200);
  }

  return (
    <div className="hotel-utility-actions">
      <button type="button" className="hotel-utility-button" onClick={handleShare}>
        Compartilhar
      </button>
      <button type="button" className="hotel-utility-button" onClick={handleSave}>
        {isSaved ? "Favoritado" : "Favoritar"}
      </button>
      {feedback ? <span className="hotel-utility-feedback">{feedback}</span> : null}
    </div>
  );
}

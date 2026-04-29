"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { brazilianCities } from "@/data/cities";
import {
  listFavoriteHotels,
  removeFavoriteHotel,
  subscribeToFavoriteHotels,
  type FavoriteHotel,
} from "@/lib/hotel-favorites";
import { normalizeText } from "@/lib/normalize-text";

type HeaderClientProps = {
  user: {
    name: string;
    globalRole: "super_admin" | "hotel_admin" | "user";
  } | null;
};

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return initials.toUpperCase() || "LP";
}

export function HeaderClient({ user }: HeaderClientProps) {
  const [time, setTime] = useState("00:00:00");
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [favoriteHotels, setFavoriteHotels] = useState<FavoriteHotel[]>([]);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const favoritesMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      setTime(`${hours}:${minutes}:${seconds}`);
    };

    updateClock();
    const intervalId = window.setInterval(updateClock, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const updateScrollState = () => {
      setIsScrolled(window.scrollY > 16);
    };

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateScrollState);
    };
  }, []);

  useEffect(() => {
    const syncFavorites = () => {
      const favorites = listFavoriteHotels();
      setFavoriteHotels(favorites);
      setFavoritesCount(favorites.length);
    };

    syncFavorites();
    return subscribeToFavoriteHotels(syncFavorites);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }

      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }

      if (!favoritesMenuRef.current?.contains(event.target as Node)) {
        setIsFavoritesOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
        setIsFavoritesOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    window.location.href = "/login";
  }

  function handleRemoveFavorite(slug: string) {
    removeFavoriteHotel(slug);
  }

  const normalizedQuery = normalizeText(query.trim());
  const suggestions = normalizedQuery
    ? brazilianCities.filter((city) => normalizeText(city).includes(normalizedQuery))
    : [];

  return (
    <header className={`site-header${isScrolled ? " is-scrolled" : ""}`}>
      <Link className="brand" href="/" aria-label="Ir para a página principal">
        <span className="brand-emblem" aria-hidden="true">
          <span className="brand-star">✦</span>
        </span>
        <span className="brand-text">LPH</span>
      </Link>

      <div className="header-meta">
        <span id="header-clock" aria-label="Horário local atual">
          {time}
        </span>

        <div ref={searchRef} className="city-search">
          <label className="sr-only" htmlFor="city-search-input">
            Buscar cidade
          </label>
          <span className="city-search-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
              <path
                fill="currentColor"
                d="M544 513L397.2 364.2C417.2 336.3 429.1 302 429.1 265C429.1 171.9 354.4 96.1 262.6 96.1C170.7 96 96 171.8 96 264.9C96 358 170.7 433.8 262.5 433.8C302.3 433.8 338.8 419.6 367.5 395.9L513.5 544L544 513zM262.5 394.8C191.9 394.8 134.4 336.5 134.4 264.9C134.4 193.3 191.9 135 262.5 135C333.1 135 390.6 193.3 390.6 264.9C390.6 336.5 333.2 394.8 262.5 394.8z"
              />
            </svg>
          </span>
          <input
            id="city-search-input"
            className="city-search-input"
            type="search"
            role="combobox"
            placeholder="Buscar cidade"
            autoComplete="off"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-expanded={isOpen && !!normalizedQuery}
            aria-controls="city-search-suggestions"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (query.trim()) {
                setIsOpen(true);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setIsOpen(false);
                event.currentTarget.blur();
              }
            }}
          />

          <div
            id="city-search-suggestions"
            className="city-search-suggestions"
            role="listbox"
            hidden={!isOpen || !normalizedQuery}
          >
            {normalizedQuery && suggestions.length === 0 ? (
              <div className="city-search-empty">Nenhuma cidade encontrada</div>
            ) : null}

            {suggestions.map((city) => (
              <button
                key={city}
                type="button"
                className="city-search-option"
                role="option"
                aria-selected={false}
                onClick={() => {
                  setQuery(city);
                  setIsOpen(false);
                }}
              >
                {city}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="header-actions">
        <div ref={favoritesMenuRef} className="favorites-menu">
          <button
            className="icon-button"
            type="button"
            aria-label={
              favoritesCount > 0 ? `Favoritos salvos: ${favoritesCount}` : "Nenhum favorito salvo"
            }
            aria-haspopup="dialog"
            aria-expanded={isFavoritesOpen}
            onClick={() => {
              setIsFavoritesOpen((current) => !current);
              setIsUserMenuOpen(false);
            }}
          >
            <svg className="header-icon" viewBox="0 0 512 512" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M462.3 62.7c-54.5-46.4-136-38.7-186.7 13.3L256 96.6l-19.6-20.6C185.7 24 104.2 16.3 49.7 62.7c-62.8 53.6-66.1 149.8-9.9 207.8l193.5 199.8c12.5 12.9 32.8 12.9 45.3 0l193.5-199.8c56.2-58 52.9-154.2-9.8-207.8z"
              />
            </svg>
            {favoritesCount > 0 ? (
              <span className="header-favorites-count">{favoritesCount}</span>
            ) : null}
          </button>

          {isFavoritesOpen ? (
            <div className="favorites-menu-panel" role="dialog" aria-label="Hotéis favoritos">
              {favoriteHotels.length > 0 ? (
                <div className="favorites-menu-list">
                  {favoriteHotels.map((hotel) => (
                    <div key={hotel.slug} className="favorites-menu-item">
                      <Link
                        className="favorites-menu-link"
                        href={`/hoteis/${hotel.slug}`}
                        onClick={() => setIsFavoritesOpen(false)}
                      >
                        {hotel.coverImageUrl ? (
                          <Image
                            className="favorites-menu-thumb"
                            src={hotel.coverImageUrl}
                            alt={`Capa do hotel ${hotel.name}`}
                            width={56}
                            height={56}
                            sizes="56px"
                            unoptimized
                          />
                        ) : (
                          <span
                            className="favorites-menu-thumb favorites-menu-thumb--placeholder"
                            aria-hidden="true"
                          >
                            {hotel.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}

                        <span className="favorites-menu-copy">
                          <strong>{hotel.name}</strong>
                          <span>
                            {hotel.city}, {hotel.state}
                          </span>
                        </span>
                      </Link>

                      <button
                        className="favorites-menu-remove"
                        type="button"
                        aria-label={`Remover ${hotel.name} dos favoritos`}
                        onClick={() => handleRemoveFavorite(hotel.slug)}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="favorites-menu-empty">Você ainda não favoritou nenhum hotel.</p>
              )}
            </div>
          ) : null}
        </div>

        {user ? (
          <div ref={userMenuRef} className="user-menu">
            <button
              className="avatar avatar--authenticated"
              type="button"
              aria-label="Abrir menu do usuário"
              aria-haspopup="menu"
              aria-expanded={isUserMenuOpen}
              title={user.name}
              onClick={() => {
                setIsUserMenuOpen((current) => !current);
                setIsFavoritesOpen(false);
              }}
            >
              <span className="avatar-initials">{getInitials(user.name)}</span>
              <span className="avatar-status" aria-hidden="true" />
            </button>

            {isUserMenuOpen ? (
              <div className="user-menu-panel" role="menu">
                <Link className="user-menu-item" href="/admin" role="menuitem">
                  Painel administrativo
                </Link>
                <button
                  className="user-menu-item"
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                >
                  Sair
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <Link className="avatar" href="/login" aria-label="Entrar na conta" title="Entrar">
            <svg
              className="header-icon profile-icon"
              viewBox="0 0 640 640"
              aria-hidden="true"
              focusable="false"
            >
              <path
                fill="currentColor"
                d="M320 312C386.3 312 440 258.3 440 192C440 125.7 386.3 72 320 72C253.7 72 200 125.7 200 192C200 258.3 253.7 312 320 312zM290.3 368C191.8 368 112 447.8 112 546.3C112 562.7 125.3 576 141.7 576L498.3 576C514.7 576 528 562.7 528 546.3C528 447.8 448.2 368 349.7 368L290.3 368z"
              />
            </svg>
          </Link>
        )}
      </div>
    </header>
  );
}

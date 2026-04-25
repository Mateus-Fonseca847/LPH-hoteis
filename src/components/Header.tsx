"use client";

import { useEffect, useRef, useState } from "react";

import { brazilianCities } from "@/data/cities";
import { normalizeText } from "@/lib/normalize-text";

export function Header() {
  const [time, setTime] = useState("00:00:00");
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);

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
    const handlePointerDown = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  const normalizedQuery = normalizeText(query.trim());
  const suggestions = normalizedQuery
    ? brazilianCities.filter((city) => normalizeText(city).includes(normalizedQuery))
    : [];

  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Página inicial da LPH">
        <span className="brand-emblem" aria-hidden="true">
          <span className="brand-star">✦</span>
        </span>
        <span className="brand-text">LPH</span>
      </a>

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
        <button className="icon-button" type="button" aria-label="Favoritos">
          <svg className="header-icon" viewBox="0 0 512 512" aria-hidden="true" focusable="false">
            <path
              fill="currentColor"
              d="M462.3 62.7c-54.5-46.4-136-38.7-186.7 13.3L256 96.6l-19.6-20.6C185.7 24 104.2 16.3 49.7 62.7c-62.8 53.6-66.1 149.8-9.9 207.8l193.5 199.8c12.5 12.9 32.8 12.9 45.3 0l193.5-199.8c56.2-58 52.9-154.2-9.8-207.8z"
            />
          </svg>
        </button>

        <span className="avatar" aria-label="Perfil do usuário">
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
        </span>
      </div>
    </header>
  );
}

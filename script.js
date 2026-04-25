const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
      }
    });
  },
  {
    threshold: 0.18,
    rootMargin: "0px 0px -40px 0px",
  }
);

document.querySelectorAll(".reveal").forEach((element) => {
  observer.observe(element);
});

const brazilianCities = [
  "S\u00e3o Paulo",
  "Rio de Janeiro",
  "Petr\u00f3polis",
  "Belo Horizonte",
  "Salvador",
  "Recife",
  "Fortaleza",
  "Curitiba",
  "Florian\u00f3polis",
  "Bras\u00edlia",
  "Goi\u00e2nia",
  "Manaus",
  "Bel\u00e9m",
  "Porto Alegre",
  "Natal",
  "Macei\u00f3",
  "Jo\u00e3o Pessoa",
  "Gramado",
  "B\u00fazios",
  "Paraty",
];

const experienceDestinations = {
  esporte: [
    {
      title: "Trilha na Serra dos \u00d3rg\u00e3os",
      description:
        "Petr\u00f3polis, Teres\u00f3polis e montanhas para quem busca aventura ao ar livre.",
      image:
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
      alt: "Montanhas e trilha ao ar livre na Serra dos \u00d3rg\u00e3os",
    },
    {
      title: "Surf em Saquarema",
      description: "Praias, ondas fortes e hospedagens pr\u00f3ximas ao circuito do surfe.",
      image:
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
      alt: "Praia com mar aberto e clima de surf em Saquarema",
    },
    {
      title: "Kitesurf em Jericoacoara",
      description: "Ventos constantes, lagoas e experi\u00eancias esportivas no litoral cearense.",
      image:
        "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80",
      alt: "Litoral ensolarado e mar aberto para kitesurf em Jericoacoara",
    },
  ],
  musica: [
    {
      title: "Noites de Bossa no Rio",
      description:
        "Hospede-se perto de bares, casas de show e experi\u00eancias musicais cariocas.",
      image:
        "https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?auto=format&fit=crop&w=1200&q=80",
      alt: "Vista noturna urbana com clima musical no Rio de Janeiro",
    },
    {
      title: "Forr\u00f3 em Recife",
      description:
        "Cultura nordestina, dan\u00e7a e hospedagens pr\u00f3ximas aos polos culturais.",
      image:
        "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1200&q=80",
      alt: "Ambiente cultural e festivo para experi\u00eancias musicais em Recife",
    },
    {
      title: "Jazz e charme em Paraty",
      description: "Eventos intimistas, centro hist\u00f3rico e estadias com clima art\u00edstico.",
      image:
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
      alt: "Rua charmosa de cidade hist\u00f3rica com atmosfera art\u00edstica em Paraty",
    },
  ],
  cinema: [
    {
      title: "Festival de Cinema de Gramado",
      description: "Hospedagens pr\u00f3ximas ao centro e ao clima cultural da Serra Ga\u00facha.",
      image:
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
      alt: "Destino charmoso de serra com clima cultural em Gramado",
    },
    {
      title: "Mostras culturais em S\u00e3o Paulo",
      description: "Fique perto de cinemas, teatros e centros culturais da cidade.",
      image:
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
      alt: "Cen\u00e1rio urbano e cultural de S\u00e3o Paulo",
    },
    {
      title: "Cine ao ar livre em Bras\u00edlia",
      description: "Arquitetura, cultura e experi\u00eancias urbanas para viajantes curiosos.",
      image:
        "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",
      alt: "Arquitetura moderna e experi\u00eancia cultural urbana em Bras\u00edlia",
    },
  ],
};

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function updateHeaderClock() {
  const clock = document.querySelector("#header-clock");

  if (!clock) return;

  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  clock.textContent = `${hours}:${minutes}:${seconds}`;
}

updateHeaderClock();
setInterval(updateHeaderClock, 1000);

const citySearchInput = document.querySelector("#city-search-input");
const citySearchSuggestions = document.querySelector("#city-search-suggestions");

function closeSuggestions() {
  if (!citySearchSuggestions || !citySearchInput) return;

  citySearchSuggestions.hidden = true;
  citySearchSuggestions.innerHTML = "";
  citySearchInput.setAttribute("aria-expanded", "false");
}

function openSuggestions() {
  if (!citySearchSuggestions || !citySearchInput) return;

  citySearchSuggestions.hidden = false;
  citySearchInput.setAttribute("aria-expanded", "true");
}

function renderSuggestions(query) {
  if (!citySearchSuggestions || !citySearchInput) return;

  const normalizedQuery = normalizeText(query.trim());
  const matches = brazilianCities.filter((city) => normalizeText(city).includes(normalizedQuery));

  citySearchSuggestions.innerHTML = "";

  if (!normalizedQuery) {
    closeSuggestions();
    return;
  }

  if (!matches.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "city-search-empty";
    emptyState.textContent = "Nenhuma cidade encontrada";
    citySearchSuggestions.appendChild(emptyState);
    openSuggestions();
    return;
  }

  matches.forEach((city) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "city-search-option";
    option.setAttribute("role", "option");
    option.textContent = city;
    option.addEventListener("click", () => {
      citySearchInput.value = city;
      closeSuggestions();
    });
    citySearchSuggestions.appendChild(option);
  });

  openSuggestions();
}

if (citySearchInput && citySearchSuggestions) {
  citySearchInput.addEventListener("input", (event) => {
    renderSuggestions(event.target.value);
  });

  citySearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSuggestions();
      citySearchInput.blur();
    }
  });

  document.addEventListener("click", (event) => {
    if (!citySearchInput.contains(event.target) && !citySearchSuggestions.contains(event.target)) {
      closeSuggestions();
    }
  });
}

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (event) => {
    const targetId = anchor.getAttribute("href");
    const target = targetId ? document.querySelector(targetId) : null;

    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
});

document.querySelector(".footer-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
});

const experienceFilters = document.querySelectorAll(".experience-filter");
const experienceCards = document.querySelectorAll(".experience-card");
const showcaseGallery = document.querySelector(".showcase-gallery");
let isExperienceTransitioning = false;

experienceCards.forEach((card, index) => {
  card.classList.toggle("experience-card--featured", index === 0);
  card.classList.toggle("experience-card--small", index !== 0);
});

function renderExperienceCards(category) {
  const destinations = experienceDestinations[category];

  if (!destinations || !experienceCards.length) return;

  experienceCards.forEach((card, index) => {
    const destination = destinations[index];
    if (!destination) return;

    const image = card.querySelector("img");
    const title = card.querySelector(".gallery-caption strong");
    const description = card.querySelector(".gallery-caption span");

    if (image) {
      image.src = destination.image;
      image.alt = destination.alt;
    }

    if (title) {
      title.textContent = destination.title;
    }

    if (description) {
      description.textContent = destination.description;
    }
  });
}

if (experienceFilters.length) {
  renderExperienceCards("esporte");

  experienceFilters.forEach((filter) => {
    filter.addEventListener("click", () => {
      if (isExperienceTransitioning || filter.classList.contains("active")) return;

      experienceFilters.forEach((button) => {
        button.classList.remove("active");
        button.setAttribute("aria-pressed", "false");
      });

      filter.classList.add("active");
      filter.setAttribute("aria-pressed", "true");
      isExperienceTransitioning = true;
      showcaseGallery?.classList.add("is-transitioning");

      window.setTimeout(() => {
        renderExperienceCards(filter.dataset.experience);
        showcaseGallery?.classList.remove("is-transitioning");

        window.setTimeout(() => {
          isExperienceTransitioning = false;
        }, 220);
      }, 180);
    });
  });
}

const hotelCarousel = document.querySelector(".hotel-carousel");
const hotelCardsTrack = document.querySelector(".hotel-cards-track");
const hotelCarouselButtons = document.querySelectorAll(".hotel-carousel-button");

if (hotelCarousel && hotelCardsTrack) {
  const originalCards = Array.from(hotelCardsTrack.children);
  const duplicateFragment = document.createDocumentFragment();
  let isPaused = false;
  let lastTimestamp = 0;
  const pixelsPerSecond = 36;
  let resumeTimeoutId = null;

  originalCards.forEach((card) => {
    const clone = card.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    duplicateFragment.appendChild(clone);
  });

  hotelCardsTrack.appendChild(duplicateFragment);

  function stepCarousel(timestamp) {
    if (!lastTimestamp) {
      lastTimestamp = timestamp;
    }

    const delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    if (!isPaused) {
      const halfWidth = hotelCardsTrack.scrollWidth / 2;
      hotelCardsTrack.scrollLeft += (pixelsPerSecond * delta) / 1000;

      if (hotelCardsTrack.scrollLeft >= halfWidth) {
        hotelCardsTrack.scrollLeft -= halfWidth;
      }
    }

    window.requestAnimationFrame(stepCarousel);
  }

  function resetCarouselPosition() {
    hotelCardsTrack.scrollLeft = 0;
    lastTimestamp = 0;
  }

  function getLoopWidth() {
    return hotelCardsTrack.scrollWidth / 2;
  }

  function normalizeLoopPosition() {
    const loopWidth = getLoopWidth();

    if (hotelCardsTrack.scrollLeft >= loopWidth) {
      hotelCardsTrack.scrollLeft -= loopWidth;
    }

    if (hotelCardsTrack.scrollLeft < 0) {
      hotelCardsTrack.scrollLeft += loopWidth;
    }
  }

  function pauseAutoScrollTemporarily() {
    isPaused = true;

    if (resumeTimeoutId) {
      window.clearTimeout(resumeTimeoutId);
    }

    resumeTimeoutId = window.setTimeout(() => {
      isPaused = false;
    }, 1800);
  }

  function moveCarousel(direction) {
    const firstCard = hotelCardsTrack.querySelector(".hotel-card");

    if (!firstCard) return;

    const trackStyles = window.getComputedStyle(hotelCardsTrack);
    const gap = Number.parseFloat(trackStyles.gap || "0");
    const step = firstCard.getBoundingClientRect().width + gap;

    pauseAutoScrollTemporarily();
    hotelCardsTrack.scrollBy({
      left: direction * step,
      behavior: "smooth",
    });

    window.setTimeout(() => {
      normalizeLoopPosition();
    }, 420);
  }

  hotelCarousel.addEventListener("mouseenter", () => {
    isPaused = true;
  });

  hotelCarousel.addEventListener("mouseleave", () => {
    isPaused = false;
  });

  hotelCarouselButtons.forEach((button) => {
    button.addEventListener("click", () => {
      moveCarousel(button.dataset.direction === "prev" ? -1 : 1);
    });
  });

  window.addEventListener("resize", resetCarouselPosition);

  window.requestAnimationFrame(stepCarousel);
}

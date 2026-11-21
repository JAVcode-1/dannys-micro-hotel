import type { PublishedReviewPage } from "@staytrack/shared";
import { useEffect, useRef, useState } from "react";
import { apiBase } from "./staff-auth";

type CatalogPackage = {
  code: string;
  duration_minutes: number;
  price_centavos: number;
};

type Photo = {
  name: string;
  alt: string;
  widths: readonly number[];
  width: number;
  height: number;
};

const photos = {
  daytime: {
    name: "daytime",
    alt: "Daytime view of Danny’s Micro Hotel courtyard and colorful guest rooms",
    widths: [640, 960, 1440, 1920],
    width: 2048,
    height: 1536,
  },
  standard: {
    name: "standard",
    alt: "Double Standard room with beds and striped walls",
    widths: [420, 760, 1040],
    width: 3072,
    height: 4096,
  },
  standardBlue: {
    name: "standard-blue",
    alt: "Double Standard room with blue walls",
    widths: [420, 760, 1040],
    width: 3072,
    height: 4096,
  },
  family: {
    name: "family",
    alt: "Family Executive room with two beds and a geometric ceiling",
    widths: [420, 760, 1040],
    width: 3072,
    height: 4096,
  },
  familyWindow: {
    name: "family-window",
    alt: "Family Executive room from the window side",
    widths: [420, 760, 1040],
    width: 3072,
    height: 4096,
  },
  hall: {
    name: "hall",
    alt: "Danny’s Function Hall set up in theater style",
    widths: [480, 960],
    width: 960,
    height: 636,
  },
  nighttime: {
    name: "nighttime",
    alt: "Danny’s Micro Hotel walkway and room doors lit at night",
    widths: [480, 960, 1440],
    width: 2048,
    height: 1536,
  },
} satisfies Record<string, Photo>;

const rooms = [
  {
    code: "double_standard",
    name: "Double Standard",
    description: "For a short stop or a full-day stay.",
    photos: [photos.standard, photos.standardBlue],
  },
  {
    code: "family_executive",
    name: "Family Executive",
    description: "For family stays, with an optional extra bed.",
    photos: [photos.family, photos.familyWindow],
  },
];

const currency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function usePublicData<T>(path: string, enabled = true) {
  const [data, setData] = useState<T>();
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void fetch(apiBase + path, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const result: T = await response.json();
        if (!controller.signal.aborted) setData(result);
      })
      .catch(() => {
        // The landing page remains useful while supplementary data is unavailable.
      });
    return () => controller.abort();
  }, [path, enabled]);
  return enabled ? data : undefined;
}

function Logo() {
  return (
    <a className="landing-logo" href="/" aria-label="Danny’s Micro Hotel home">
      <img src="/hotel/logo.webp" alt="" width="238" height="225" />
    </a>
  );
}

function Photograph({
  photo,
  sizes,
  eager = false,
}: {
  photo: Photo;
  sizes: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span
        className="landing-photo-fallback"
        role="img"
        aria-label={photo.alt + " — photo unavailable"}
      />
    );
  return (
    <img
      src={`/hotel/${photo.name}-${photo.widths[0]}.webp`}
      srcSet={photo.widths
        .map((width) => `/hotel/${photo.name}-${width}.webp ${width}w`)
        .join(", ")}
      sizes={sizes}
      width={photo.width}
      height={photo.height}
      alt={photo.alt}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const [animate, setAnimate] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !window.matchMedia) return;
    const desktop = window.matchMedia("(min-width: 62rem)");
    function closeAtDesktop(event: MediaQueryListEvent) {
      if (event.matches) setOpen(false);
    }
    desktop.addEventListener("change", closeAtDesktop);
    return () => desktop.removeEventListener("change", closeAtDesktop);
  }, [open]);

  const links = [
    ["/rooms", "Rooms & Rates"],
    ["#function-hall", "Function Hall"],
    ["#about", "About"],
    ["/verify", "Guest Access"],
  ];

  return (
    <header
      className="landing-header"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        setAnimate(false);
        setOpen(false);
        trigger.current?.focus();
      }}
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget))
          setOpen(false);
      }}
    >
      <div className="landing-header-inner">
        <Logo />
        <nav className="landing-nav" aria-label="Main navigation">
          {links.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <a className="landing-button landing-header-book" href="/book">
          Plan your stay
        </a>
        <button
          type="button"
          ref={trigger}
          className="landing-menu-trigger"
          aria-expanded={open}
          aria-controls="landing-mobile-nav"
          onClick={(event) => {
            setAnimate(event.detail > 0);
            setOpen((current) => !current);
          }}
        >
          {open ? "Close" : "Menu"}
          <span className="landing-menu-mark" aria-hidden="true" />
        </button>
        <nav
          id="landing-mobile-nav"
          className="landing-mobile-nav"
          aria-label="Mobile navigation"
          inert={!open}
          data-open={open}
          data-animate={animate}
        >
          {links.map(([href, label]) => (
            <a
              key={href}
              href={href}
              onClick={(event) => {
                setAnimate(event.detail > 0);
                setOpen(false);
              }}
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

function RoomGallery({ room }: { room: (typeof rooms)[number] }) {
  const [selected, setSelected] = useState(0);
  const [animate, setAnimate] = useState(false);
  return (
    <figure className="landing-gallery">
      <div
        className="landing-photo landing-room-photo"
        data-reveal
        data-animate={animate}
      >
        {room.photos.map((photo, index) => (
          <div
            key={photo.name}
            className="landing-gallery-layer"
            data-selected={selected === index}
            aria-hidden={selected !== index}
          >
            <Photograph
              photo={photo}
              sizes="(min-width: 90rem) 640px, (min-width: 62rem) 49vw, (min-width: 48rem) 53vw, calc(100vw - 40px)"
            />
          </div>
        ))}
      </div>
      <figcaption
        className="landing-gallery-controls"
        aria-label={room.name + " photos"}
      >
        {room.photos.map((photo, index) => (
          <button
            key={photo.name}
            type="button"
            aria-pressed={selected === index}
            aria-label={`${room.name} photo ${index + 1} of ${room.photos.length}`}
            onClick={(event) => {
              setAnimate(event.detail > 0);
              setSelected(index);
            }}
          >
            {String(index + 1).padStart(2, "0")}
          </button>
        ))}
      </figcaption>
    </figure>
  );
}

function RoomFeature({
  room,
  packages,
}: {
  room: (typeof rooms)[number];
  packages: CatalogPackage[] | undefined;
}) {
  const rows = packages?.filter((item) => item.code === room.code) ?? [];
  const startingRate = rows.reduce<CatalogPackage | undefined>(
    (lowest, item) =>
      !lowest || item.price_centavos < lowest.price_centavos ? item : lowest,
    undefined,
  );
  return (
    <article className="landing-room">
      <RoomGallery room={room} />
      <div className="landing-room-copy">
        <h3>{room.name}</h3>
        <p>{room.description}</p>
        {startingRate && (
          <p className="landing-rate">
            From{" "}
            <strong>
              {currency.format(startingRate.price_centavos / 100)}
            </strong>{" "}
            for {startingRate.duration_minutes / 60} hours
          </p>
        )}
        <a className="landing-text-link" href="/rooms">
          View packages <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}

function Reviews({ enabled }: { enabled: boolean }) {
  const page = usePublicData<PublishedReviewPage>("/reviews?page=1", enabled);
  if (!page?.count) return null;
  return (
    <section
      className="landing-wrap landing-reviews"
      aria-labelledby="landing-reviews-title"
    >
      <h2 id="landing-reviews-title">Verified guest reviews</h2>
      {page.average !== null && (
        <p>
          {page.average} out of 5 · {page.count} published{" "}
          {page.count === 1 ? "rating" : "ratings"}
        </p>
      )}
      {page.reviews.slice(0, 2).map((review) => (
        <article key={review.id}>
          <h3>{review.alias}</h3>
          <p>{review.stars} out of 5</p>
          {review.comment && (
            <p className="landing-review-comment">{review.comment}</p>
          )}
        </article>
      ))}
      <a className="landing-text-link" href="/reviews">
        Read guest reviews <span aria-hidden="true">↗</span>
      </a>
    </section>
  );
}

export default function LandingPage({
  reviewsEnabled,
  hallEnabled,
}: {
  reviewsEnabled: boolean;
  hallEnabled: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const packages = usePublicData<CatalogPackage[]>("/catalog");

  useEffect(() => {
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.intersectionRatio <= 0.55)
            entry.target.classList.add("landing-reveal");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12 },
    );
    root.current
      ?.querySelectorAll("[data-reveal]")
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing" ref={root}>
      <a className="landing-skip" href="#landing-main">
        Skip to content
      </a>
      <Header />
      <main id="landing-main" tabIndex={-1}>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-wrap landing-hero-copy">
            <h1 id="landing-title">Stay on your schedule.</h1>
            <div className="landing-hero-intro">
              <p>Short stays or a full day at Danny’s Micro Hotel.</p>
              <div className="landing-hero-actions">
                <a className="landing-button" href="/book">
                  Plan your stay <span aria-hidden="true">↗</span>
                </a>
                <a className="landing-text-link" href="/rooms">
                  Rooms &amp; rates
                </a>
              </div>
              <p className="landing-booking-status">
                Online booking is currently closed.
              </p>
            </div>
          </div>
          <div className="landing-hero-photo landing-photo">
            <Photograph
              photo={photos.daytime}
              sizes="(min-width: 104rem) 1600px, (min-width: 62rem) calc(100vw - 80px), calc(100vw - 32px)"
              eager
            />
          </div>
        </section>
        <div className="landing-wrap landing-highlights">
          <span>Open 24 hours</span>
          <a href="#landing-rooms">
            Flexible stay lengths <span aria-hidden="true">↓</span>
          </a>
          <a href="#function-hall">
            Function Hall <span aria-hidden="true">↓</span>
          </a>
        </div>
        <section
          className="landing-wrap landing-rooms"
          aria-labelledby="landing-rooms"
        >
          <h2 id="landing-rooms" tabIndex={-1}>
            Rooms &amp; rates
          </h2>
          {rooms.map((room) => (
            <RoomFeature key={room.code} room={room} packages={packages} />
          ))}
        </section>
        <section
          className="landing-hall"
          id="function-hall"
          tabIndex={-1}
          aria-labelledby="landing-hall-title"
        >
          <div className="landing-wrap landing-hall-inner">
            <div className="landing-hall-copy">
              <h2 id="landing-hall-title">Function Hall</h2>
              <p>
                A space for meetings and gatherings, with two seating layouts.
              </p>
              <dl>
                <div>
                  <dt>Theater type</dt>
                  <dd>Up to 70 guests</dd>
                </div>
                <div>
                  <dt>Room type</dt>
                  <dd>Up to 50 guests</dd>
                </div>
              </dl>
              {hallEnabled && (
                <a className="landing-text-link" href="/function-hall">
                  View hall information <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
            <div className="landing-photo landing-hall-photo" data-reveal>
              <Photograph
                photo={photos.hall}
                sizes="(min-width: 90rem) 840px, (min-width: 62rem) 60vw, calc(100vw - 40px)"
              />
            </div>
          </div>
        </section>
        <section
          className="landing-about"
          id="about"
          tabIndex={-1}
          aria-labelledby="landing-about-title"
        >
          <div className="landing-wrap landing-about-inner">
            <div className="landing-photo landing-about-photo" data-reveal>
              <Photograph
                photo={photos.nighttime}
                sizes="(min-width: 90rem) 690px, (min-width: 62rem) 54vw, calc(100vw - 40px)"
              />
            </div>
            <div>
              <h2 id="landing-about-title">About Danny’s Micro Hotel</h2>
              <p>
                We’re open 24 hours, with Double Standard and Family Executive
                rooms for short stays and longer visits. Our Function Hall
                offers space for meetings and gatherings.
              </p>
              <a className="landing-text-link" href="/book">
                Plan your stay <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </section>
        <Reviews enabled={reviewsEnabled} />
      </main>
      <footer className="landing-footer">
        <div className="landing-wrap landing-footer-inner">
          <div className="landing-footer-brand">
            <Logo />
            <p>
              Danny’s Micro Hotel
              <br />
              <span>Open 24 hours</span>
            </p>
          </div>
          <nav aria-label="Footer navigation">
            <a href="/rooms">Rooms &amp; Rates</a>
            <a href="/verify">Guest Access</a>
            <a href="/book">Plan your stay</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

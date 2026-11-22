import type { PublishedReviewPage } from "@staytrack/shared";
import { useEffect, useRef, useState } from "react";
import { hotelContact } from "./hotel-contact";
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
  standardGreen: {
    name: "standard-green",
    alt: "Double Standard room with green walls",
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
} satisfies Record<string, Photo>;

const rooms = [
  {
    code: "double_standard",
    name: "Double Standard",
    occupancy: "Usually comfortable for 2 guests",
    description: "A simple room for a short break or a night’s rest.",
    photos: [photos.standard, photos.standardBlue, photos.standardGreen],
  },
  {
    code: "family_executive",
    name: "Family Executive",
    occupancy: "Usually comfortable for 3 guests",
    description:
      "More room to settle in together, with an optional extra bed for ₱100 per stay.",
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

function Logo({
  lazy = false,
  cropped = false,
  wordmark = false,
}: {
  lazy?: boolean;
  cropped?: boolean;
  wordmark?: boolean;
}) {
  return (
    <a
      className="landing-brand"
      href="#top"
      aria-label="Danny’s Micro Hotel, back to top"
    >
      <img
        src={cropped ? "/hotel/logo.webp" : "/hotel/logo-full.webp"}
        alt=""
        width={cropped ? 238 : 320}
        height={cropped ? 225 : 239}
        loading={lazy ? "lazy" : undefined}
      />
      {wordmark && (
        <span className="landing-brand-wordmark">
          Danny’s <small>MICRO HOTEL</small>
        </span>
      )}
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
  const [mobile, setMobile] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const header = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const element = header.current;
    const page = element?.closest<HTMLElement>(".landing");
    if (!element || !page) return;
    const sections = ["rooms", "how-to-book", "hall", "contact"]
      .map((id) => page.querySelector<HTMLElement>(`#${id}`))
      .filter((section) => section !== null);
    const reloaded = performance
      .getEntriesByType("navigation")
      .some(
        (entry) => (entry as PerformanceNavigationTiming).type === "reload",
      );
    if (reloaded) {
      history.replaceState(
        history.state,
        "",
        location.pathname + location.search,
      );
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    let headerHeight = 0;
    let frame = 0;
    let previousSection = "";
    let wasScrolled = false;

    function updateLocation() {
      frame = 0;
      const { scrollY, innerHeight } = window;
      const marker = Math.max(headerHeight + 16, innerHeight * 0.35);
      let sectionId = "";
      for (const section of sections) {
        if (section.getBoundingClientRect().top > marker) break;
        sectionId = section.id;
      }
      if (
        scrollY > 0 &&
        scrollY + innerHeight >= document.documentElement.scrollHeight - 2
      ) {
        // Near the footer, an anchor can be visible without reaching the header.
        const target = sections.find(
          (section) => `#${section.id}` === window.location.hash,
        );
        sectionId =
          target && target.getBoundingClientRect().top > headerHeight + 24
            ? target.id
            : (sections.at(-1)?.id ?? sectionId);
      }
      if (previousSection !== sectionId) {
        previousSection = sectionId;
        setActiveSection(sectionId);
      }
      const isScrolled = scrollY > 16;
      if (wasScrolled !== isScrolled) {
        wasScrolled = isScrolled;
        setScrolled(wasScrolled);
      }
    }

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(updateLocation);
    };
    const measure = () => {
      const height = element.getBoundingClientRect().height;
      if (height !== headerHeight) {
        headerHeight = height;
        page.style.setProperty("--landing-header-offset", `${height}px`);
      }
    };
    const onResize = () => {
      measure();
      schedule();
    };
    measure();
    if (window.scrollY === 0) {
      const initialTarget = sections.find(
        (section) => `#${section.id}` === window.location.hash,
      );
      initialTarget?.scrollIntoView?.({ behavior: "instant" });
    }
    updateLocation();
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(onResize);
    observer?.observe(element);
    observer?.observe(page);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("hashchange", schedule);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("hashchange", schedule);
      if (frame) window.cancelAnimationFrame(frame);
      page.style.removeProperty("--landing-header-offset");
    };
  }, []);

  useEffect(() => {
    const viewport = window.matchMedia?.("(max-width: 42rem)");
    if (!viewport) return;
    const syncMenu = () => {
      setMobile(viewport.matches);
      setOpen(false);
    };
    syncMenu();
    viewport.addEventListener("change", syncMenu);
    return () => viewport.removeEventListener("change", syncMenu);
  }, []);

  useEffect(() => {
    if (open) firstLink.current?.focus();
  }, [open]);

  return (
    <header
      className="landing-site-head"
      ref={header}
      data-scrolled={scrolled || undefined}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        setOpen(false);
        trigger.current?.focus();
      }}
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget))
          setOpen(false);
      }}
    >
      <div className="landing-wrap landing-head-inner">
        <Logo cropped wordmark />
        <nav
          className="landing-nav"
          id="landing-navigation"
          aria-label="Main"
          data-open={open || undefined}
          inert={mobile && !open}
        >
          <a
            href="#rooms"
            ref={firstLink}
            aria-current={activeSection === "rooms" ? "location" : undefined}
            onClick={() => setOpen(false)}
          >
            Rooms &amp; rates
          </a>
          <a
            href="#how-to-book"
            aria-current={
              activeSection === "how-to-book" ? "location" : undefined
            }
            onClick={() => setOpen(false)}
          >
            How to book
          </a>
          <a
            href="#hall"
            aria-current={activeSection === "hall" ? "location" : undefined}
            onClick={() => setOpen(false)}
          >
            Function Hall
          </a>
          <a
            href="#contact"
            aria-current={activeSection === "contact" ? "location" : undefined}
            onClick={() => setOpen(false)}
          >
            Contact
          </a>
        </nav>
        <div className="landing-head-actions">
          <button
            type="button"
            ref={trigger}
            className="landing-menu-toggle"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="landing-navigation"
            onClick={() => setOpen((current) => !current)}
          >
            <span className="landing-menu-icon" aria-hidden="true" />
          </button>
          <a className="landing-button landing-button-orange" href="/book">
            Book a room <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </header>
  );
}

function RoomGallery({ room }: { room: (typeof rooms)[number] }) {
  const track = useRef<HTMLDivElement>(null);
  const pending = useRef<number | null>(null);
  const [selected, setSelected] = useState(0);
  const total = room.photos.length;

  function currentSlide(element: HTMLDivElement) {
    if (!element.clientWidth) return 0;
    return Math.max(
      0,
      Math.min(total - 1, Math.round(element.scrollLeft / element.clientWidth)),
    );
  }

  function move(step: number, animate: boolean) {
    const element = track.current;
    if (!element?.clientWidth) return;
    const current = currentSlide(element);
    const next = ((pending.current ?? current) + step + total) % total;
    const smooth =
      animate &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches &&
      Math.abs(next - current) === 1;
    pending.current = smooth ? next : null;
    element.scrollTo({
      left: next * element.clientWidth,
      behavior: smooth ? "smooth" : "instant",
    });
  }

  return (
    <div
      className="landing-gallery"
      role="group"
      aria-label={room.name + " photo gallery"}
    >
      <div
        className="landing-track"
        ref={track}
        tabIndex={0}
        aria-label={room.name + " photos. Use the arrow keys to browse."}
        onScroll={(event) => setSelected(currentSlide(event.currentTarget))}
        onScrollEnd={() => {
          pending.current = null;
        }}
        onPointerDown={() => {
          pending.current = null;
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          move(event.key === "ArrowLeft" ? -1 : 1, false);
        }}
      >
        {room.photos.map((photo) => (
          <Photograph
            key={photo.name}
            photo={photo}
            sizes="(max-width: 42rem) 91vw, (min-width: 100rem) 705px, 45vw"
          />
        ))}
      </div>
      <div className="landing-gallery-bar">
        <span className="landing-count" aria-live="polite">
          Photo {selected + 1} of {total}
        </span>
        <div className="landing-gallery-buttons">
          <button
            type="button"
            className="landing-arrow"
            aria-label={"Previous " + room.name + " photo"}
            onClick={(event) => move(-1, event.detail > 0)}
          >
            ←
          </button>
          <button
            type="button"
            className="landing-arrow"
            aria-label={"Next " + room.name + " photo"}
            onClick={(event) => move(1, event.detail > 0)}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}

function RoomCard({
  room,
  packages,
}: {
  room: (typeof rooms)[number];
  packages: CatalogPackage[] | undefined;
}) {
  const rows = packages?.filter((item) => item.code === room.code) ?? [];
  const hours = [
    ...new Set(rows.map((item) => item.duration_minutes / 60)),
  ].sort((a, b) => a - b);
  const durations = new Intl.ListFormat("en-PH", { type: "disjunction" })
    .format(hours.map(String))
    .replace(", or ", " or ");
  const price = Math.min(...rows.map((item) => item.price_centavos));

  return (
    <article className="landing-card" aria-labelledby={room.code + "-title"}>
      <RoomGallery room={room} />
      <div className="landing-card-body">
        {hours.length > 0 && (
          <div className="landing-eyebrow">{durations} hours</div>
        )}
        <h3 id={room.code + "-title"}>{room.name}</h3>
        <p>
          <span className="landing-occupancy">{room.occupancy}</span>
          {room.description}
        </p>
        <div className="landing-card-footer">
          <span className="landing-price">
            {rows.length > 0
              ? "From " + currency.format(price / 100)
              : "Rates unavailable"}
          </span>
          <a
            className="landing-button landing-button-blue"
            href={"/book?category=" + room.code}
          >
            Choose {room.name} <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </article>
  );
}

function Reviews({ enabled }: { enabled: boolean }) {
  const page = usePublicData<PublishedReviewPage>("/reviews?page=1", enabled);
  if (!page?.count) return null;
  return (
    <section
      className="landing-wrap landing-reviews landing-reveal"
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

function Contact() {
  return (
    <section
      className="landing-contact landing-reveal"
      id="contact"
      aria-labelledby="contact-title"
      tabIndex={-1}
    >
      <div className="landing-wrap landing-contact-inner">
        <div>
          <div className="landing-eyebrow">Contact</div>
          <h2 id="contact-title">Get in touch.</h2>
          <p>
            For room and Function Hall inquiries. The details shown here are
            placeholders for this preview.
          </p>
        </div>
        <address>
          <div className="landing-contact-row">
            <span>Email</span>
            <span>{hotelContact.email}</span>
          </div>
          {hotelContact.phones.map(({ label, number }) => (
            <div className="landing-contact-row" key={label}>
              <span>{label}</span>
              <span>{number}</span>
            </div>
          ))}
        </address>
      </div>
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
  const packages = usePublicData<CatalogPackage[]>("/catalog");

  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>(".landing-reveal");
    if (
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      sections.forEach((section) => section.setAttribute("data-visible", ""));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute("data-visible", "");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing" id="top" tabIndex={-1}>
      <a className="landing-skip" href="#landing-main">
        Skip to content
      </a>
      <Header />
      <main id="landing-main" tabIndex={-1}>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <div className="landing-eyebrow">Open 24 hours</div>
            <h1 id="landing-title">
              Stay on <br />
              <em>your time.</em>
            </h1>
            <p>
              Rest for a few hours or settle in overnight at Danny’s Micro
              Hotel.
            </p>
            <div className="landing-hero-actions">
              <a className="landing-button landing-button-orange" href="/book">
                Plan your stay <span aria-hidden="true">↗</span>
              </a>
              <a className="landing-text-link" href="#rooms">
                Explore rooms <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>
          <figure className="landing-hero-media">
            <Photograph
              photo={photos.daytime}
              sizes="(max-width: 42rem) 100vw, (max-width: 55rem) 50vw, (min-width: 100rem) 928px, 58vw"
              eager
            />
            <figcaption>The courtyard at Danny’s</figcaption>
          </figure>
        </section>

        <div className="landing-wrap">
          <section
            className="landing-intro landing-reveal"
            aria-labelledby="intro-title"
          >
            <div>
              <div className="landing-eyebrow">Welcome to Danny’s</div>
              <h2 id="intro-title">A place to pause.</h2>
            </div>
            <p>
              Drop in for a break between plans, stay overnight with family, or
              bring people together in our Function Hall. Our room packages let
              you choose how long you need.
            </p>
          </section>

          <section
            className="landing-rooms landing-reveal"
            id="rooms"
            aria-labelledby="rooms-title"
            tabIndex={-1}
          >
            <div className="landing-section-head">
              <div>
                <div className="landing-eyebrow">Rooms &amp; rates</div>
                <h2 id="rooms-title">Find your room.</h2>
              </div>
              <p>
                Browse the room photos and compare packages for a short stop, an
                overnight stay, or a full day.
              </p>
            </div>
            <div className="landing-room-grid">
              {rooms.map((room) => (
                <RoomCard key={room.code} room={room} packages={packages} />
              ))}
            </div>
            <a className="landing-text-link" href="/rooms">
              View full room rates <span aria-hidden="true">↗</span>
            </a>
          </section>
          <section
            className="landing-booking-guide landing-reveal"
            id="how-to-book"
            aria-labelledby="booking-guide-title"
            tabIndex={-1}
          >
            <div className="landing-section-head">
              <div>
                <div className="landing-eyebrow">Your stay, step by step</div>
                <h2 id="booking-guide-title">How to book online.</h2>
              </div>
              <p>
                New here? Follow these steps when online booking is available.
                The booking page shows whether reservations are open.
              </p>
            </div>
            <ol className="landing-booking-steps" role="list">
              <li>
                <h3>Choose your stay</h3>
                <p>
                  Select Book a room, then choose your room category, date,
                  arrival time, package and guests. Each room can have its own
                  schedule.
                </p>
              </li>
              <li>
                <h3>Verify your email</h3>
                <p>
                  Use the email verification code to continue. You can book
                  without creating an account. Keep access to this email to
                  manage your reservation.
                </p>
              </li>
              <li>
                <h3>Review &amp; reserve</h3>
                <p>
                  Check availability, the full price and policies. Enter your
                  contact details and create your 30-minute hold to continue to
                  payment.
                </p>
              </li>
              <li>
                <h3>Pay &amp; submit proof</h3>
                <p>
                  Pay the full amount using the hotel’s GCash QR shown in your
                  booking. Submit your transaction reference and payment
                  screenshot before the hold expires.
                </p>
              </li>
              <li>
                <h3>Wait for confirmation</h3>
                <p>
                  A screenshot alone does not confirm your booking. Confirmation
                  follows after staff verifies the actual GCash payment and
                  safely finalizes availability. Check your reservation status.
                </p>
              </li>
            </ol>
            <div className="landing-guide-footer">
              <p>
                Submitted your proof on time? Your request stays protected while
                staff reviews it, even if the original hold timer ends.
              </p>
              <a className="landing-button landing-button-orange" href="/book">
                Book a room <span aria-hidden="true">↗</span>
              </a>
            </div>
          </section>
        </div>

        <section
          className="landing-hall landing-reveal"
          id="hall"
          aria-labelledby="hall-title"
          tabIndex={-1}
        >
          <div className="landing-wrap landing-hall-inner">
            <Photograph
              photo={photos.hall}
              sizes="(max-width: 42rem) 91vw, (min-width: 100rem) 735px, 47vw"
            />
            <div>
              <div className="landing-eyebrow">Meetings &amp; events</div>
              <h2 id="hall-title">Function Hall</h2>
              <p>
                Bring your group together for a seminar, meeting, or
                celebration. The hall accommodates up to 70 guests in Theater
                Type and 50 in Room Type.
              </p>
              <p>
                First 3 hours from ₱3,000.00 before 5:00 PM or ₱5,000.00 from
                5:00 PM. Additional full hours: ₱1,000.00.
              </p>
              <div className="landing-hall-actions">
                {hallEnabled && (
                  <a
                    className="landing-button landing-button-orange"
                    href="/book?service=hall&setup=theater"
                  >
                    Book the hall <span aria-hidden="true">↗</span>
                  </a>
                )}
                <a
                  className="landing-button landing-button-line"
                  href={hallEnabled ? "/function-hall" : "#contact"}
                >
                  {hallEnabled ? "Explore hall & rates" : "Ask about the hall"}{" "}
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        <Reviews enabled={reviewsEnabled} />
        <Contact />
      </main>

      <footer className="landing-site-foot">
        <div className="landing-wrap landing-footer-inner">
          <div className="landing-footer-brand">
            <Logo lazy />
            <p>© {new Date().getFullYear()} Danny’s Micro Hotel</p>
          </div>
          <nav className="landing-footer-links" aria-label="Footer">
            <a href="#rooms">Rooms &amp; rates</a>
            <a href="#how-to-book">How to book</a>
            <a href="#hall">Function Hall</a>
            <a href="#contact">Contact</a>
            <a href="/verify">Guest access</a>
            <a href="#top">Back to top ↑</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

import type { PublishedReviewPage } from "@staytrack/shared";
import { useState } from "react";
import { useApiQuery } from "./api-query";

export default function GuestReviews() {
  const [page, setPage] = useState(1);
  const { data, isError: error } = useApiQuery<PublishedReviewPage>(
    "/reviews?page=" + page,
  );
  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-3xl font-semibold">Verified guest reviews</h1>
      <nav className="flex flex-wrap gap-4 text-primary">
        <a href="/reviews/submit">Review your stay</a>
        <a href="/feedback/private">Send private feedback</a>
      </nav>
      {error ? (
        <p role="alert">Reviews are unavailable.</p>
      ) : !data ? (
        <p role="status">Loading reviews…</p>
      ) : (
        <>
          <div className="rounded-2xl bg-white p-5">
            {data.count === 0 ? (
              <p>No published reviews yet.</p>
            ) : (
              <>
                <p className="text-2xl font-semibold">
                  {data.average} out of 5
                </p>
                <p>{data.count} published ratings</p>
                <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {data.distribution.map((count, i) => (
                    <li key={i}>
                      {i + 1} star: {count}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          {data.reviews.map((review) => (
            <article
              key={review.id}
              className="space-y-2 rounded-xl border border-subtle bg-white p-5"
            >
              <h2 className="font-semibold">{review.alias}</h2>
              <p>{review.stars} out of 5</p>
              {review.comment && (
                <p className="whitespace-pre-wrap break-words">
                  {review.comment}
                </p>
              )}
              {review.reply && (
                <blockquote className="border-l-2 border-subtle pl-3">
                  <p className="font-medium">Hotel reply</p>
                  <p className="whitespace-pre-wrap break-words">
                    {review.reply}
                  </p>
                </blockquote>
              )}
            </article>
          ))}
          <div className="flex gap-3">
            {page > 1 && (
              <button onClick={() => setPage(page - 1)}>Previous page</button>
            )}
            {data.count > page * 20 && (
              <button onClick={() => setPage(page + 1)}>Next page</button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

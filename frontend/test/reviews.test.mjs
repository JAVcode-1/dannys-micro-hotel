import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import GuestReviewAccess from "../src/GuestReviewAccess.tsx";

test("verified guest forms distinguish public consent from private follow-up", () => {
  const publicForm = renderToStaticMarkup(
    createElement(GuestReviewAccess, {
      token: "synthetic",
      reservation: "synthetic",
    }),
  );
  assert.match(publicForm, /1 star/);
  assert.match(publicForm, /5 stars/);
  assert.match(publicForm, /agree to publish/);
  assert.doesNotMatch(publicForm, /Staff may follow up/);
  const privateForm = renderToStaticMarkup(
    createElement(GuestReviewAccess, {
      token: "synthetic",
      reservation: "synthetic",
      initial: "feedback",
    }),
  );
  assert.match(privateForm, /Staff may follow up/);
  assert.doesNotMatch(privateForm, /agree to publish/);
});

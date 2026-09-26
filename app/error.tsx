"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main style={{ padding: 40 }}><h1>We couldn’t load this page.</h1><p>Your account and saved data have not been changed.</p><button className="primary-button" onClick={reset}>Try again</button></main>;
}

import Head from "next/head";
import Link from "next/link";

export const metadata = {
  title: "Welcome to Milo+",
  description: "Your Milo+ free trial is active. Download the app and start your plan.",
};

export default function MiloSuccessPage() {
  return (
    <>
      <Head>
        <title>Welcome to Milo+</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="/milo/styles.css" />
      </Head>

      <section className="success-page">
        <h1>🎉 Welcome to Milo+!</h1>
        <p>Your 7-day free trial has started. Download the app to begin:</p>

        <a
          href="https://apps.apple.com/app/milo-fitness/idXXXXXXXX"
          className="cta-button"
          target="_blank"
          rel="noreferrer"
        >
          Download on the App Store
        </a>

        <p className="subtext">Check your email for login instructions.</p>

        <div className="next-steps">
          <h3>What happens next?</h3>
          <ol>
            <li>Download the Milo+ app from the App Store</li>
            <li>Log in with the email you just used</li>
            <li>Create your first personalized plan</li>
            <li>Start your fitness journey today!</li>
          </ol>
        </div>

        <p className="reminder">You won't be charged until Day 8. Cancel anytime before then.</p>

        <Link href="/milo" className="subtext">
          ← Back to Milo+
        </Link>
      </section>
    </>
  );
}


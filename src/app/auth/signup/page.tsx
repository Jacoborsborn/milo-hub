import SignupPageContent from "@/components/signup/SignupPageContent";

/**
 * Same content as /signup. No redirect on load — safe for iOS and in-app browsers.
 * Query params (e.g. from=pt-hub-ad) are read by SignupWizard from the URL.
 */
export default function AuthSignupPage() {
  return <SignupPageContent />;
}

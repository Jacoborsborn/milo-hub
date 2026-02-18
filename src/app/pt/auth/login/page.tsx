import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

async function loginAction(formData: FormData) {
  "use server";
  console.log("LOGIN ACTION HIT");
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/pt/app");

  console.log("[LOGIN] Attempt:", { email, next });

  if (!email || !password) {
    console.log("[LOGIN] Missing credentials");
    redirect(`/pt/auth/login?error=missing&next=${encodeURIComponent(next)}`);
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  
  console.log("[LOGIN] Supabase response:", { 
    hasUser: !!data.user, 
    hasSession: !!data.session, 
    error: error?.message 
  });
  
  if (error) {
    console.log("[LOGIN] Error:", error.message);
    redirect(`/pt/auth/login?error=invalid&next=${encodeURIComponent(next)}`);
  }

  console.log("[LOGIN] Success:", { userId: data.user?.id, email: data.user?.email });
  redirect(next);
}

async function signupAction(formData: FormData) {
  "use server";
  console.log("SIGNUP ACTION HIT");
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/pt/app");

  console.log("[SIGNUP] Attempt:", { email, next });

  if (!email || !password) {
    console.log("[SIGNUP] Missing credentials");
    redirect(`/pt/auth/login?error=missing&next=${encodeURIComponent(next)}`);
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.signUp({ 
    email, 
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/pt/auth/login`
    }
  });
  
  console.log("[SIGNUP] Supabase response:", { 
    hasUser: !!data.user, 
    hasSession: !!data.session, 
    error: error?.message,
    errorCode: error?.status
  });
  
  if (error) {
    console.log("[SIGNUP] Error:", error.message, "Code:", error.status);
    // Pass the actual error message for better debugging
    const errorMsg = encodeURIComponent(error.message || "Signup failed");
    redirect(`/pt/auth/login?error=${errorMsg}&next=${encodeURIComponent(next)}`);
  }

  // Check if email confirmation is required
  if (data.user && !data.session) {
    console.log("[SIGNUP] Email confirmation required - user created but no session");
    redirect(`/pt/auth/login?error=confirm_email&next=${encodeURIComponent(next)}`);
  }

  // If we have a session, set cookies and redirect
  if (data.session) {
    console.log("[SIGNUP] Success with session:", { userId: data.user?.id, email: data.user?.email });
    redirect(next);
  }

  // Fallback: user created but no session (should have been caught above)
  console.log("[SIGNUP] User created but no session - redirecting to confirm");
  redirect(`/pt/auth/login?error=confirm_email&next=${encodeURIComponent(next)}`);
}

export default async function PtLogin({
    searchParams,
  }: {
    searchParams?: Promise<{ next?: string; error?: string }>;
  }) {
    const params = await searchParams;
    const next = params?.next ?? "/pt/app";
    const error = params?.error;
    
    const errorMessage = error === "missing" 
      ? "Email and password are required"
      : error === "invalid"
      ? "Invalid email or password"
      : error === "confirm_email"
      ? "Please check your email to confirm your account"
      : error
      ? decodeURIComponent(error)
      : null;
  
    return (
      <main style={{ padding: 24, maxWidth: 420 }}>
        <h1>PT Login</h1>
        {errorMessage && <p style={{ color: "crimson" }}>{errorMessage}</p>}
  
        <h3>Sign up</h3>
        <form action={signupAction}>
          <input type="hidden" name="next" value={next} />
          <input 
            name="email" 
            type="email"
            placeholder="email" 
            required
            style={{ width: "100%", padding: 8, marginTop: 8 }} 
          />
          <input
            name="password"
            placeholder="password"
            type="password"
            required
            style={{ width: "100%", padding: 8, marginTop: 8 }}
          />
          <button style={{ marginTop: 8, padding: "8px 16px" }} type="submit">
            Create account
          </button>
        </form>
  
        <hr style={{ margin: "16px 0" }} />
  
        <h3>Log in</h3>
        <form action={loginAction}>
          <input type="hidden" name="next" value={next} />
          <input 
            name="email" 
            type="email"
            placeholder="email" 
            required
            style={{ width: "100%", padding: 8, marginTop: 8 }} 
          />
          <input
            name="password"
            placeholder="password"
            type="password"
            required
            style={{ width: "100%", padding: 8, marginTop: 8 }}
          />
          <button style={{ marginTop: 8, padding: "8px 16px" }} type="submit">
            Log in
          </button>
        </form>
      </main>
    );
  }

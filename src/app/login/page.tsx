"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ShieldCheck, Command, LoaderCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { display_name: name.trim() } }
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("Account created. Check your email to confirm your account, then sign in.");
        } else {
          router.replace(params.get("next") || "/");
          router.refresh();
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(params.get("next") || "/");
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="grid min-h-screen place-items-center px-4 py-10">
    <div className="grid-bg fixed inset-0 -z-10"/>
    <section className="panel w-full max-w-md rounded-3xl p-6 shadow-glow sm:p-8">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-300/10 text-cyan-300 ring-1 ring-cyan-300/25"><Command size={23}/></span>
        <span><strong className="tracking-[.16em]">CYBERX <b className="text-cyan-300">OS</b></strong><small className="block text-[10px] tracking-[.2em] text-slate-500">SECURE WORKSPACE</small></span>
      </Link>
      <div className="mb-6"><div className="mb-3 flex items-center gap-2 text-xs text-cyan-300"><ShieldCheck size={15}/> SECURE ACCOUNT ACCESS</div><h1 className="text-2xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h1><p className="mt-2 text-sm text-slate-500">{mode === "login" ? "Sign in to access your CYBERX workspace." : "Your account gives you one identity across the ecosystem."}</p></div>
      <form onSubmit={submit} className="space-y-4">
        {mode === "signup" && <label className="block text-xs text-slate-400">Display name<input required maxLength={60} value={name} onChange={e=>setName(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50" placeholder="Your name"/></label>}
        <label className="block text-xs text-slate-400">Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50" placeholder="you@example.com"/></label>
        <label className="block text-xs text-slate-400">Password<input required minLength={8} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50" placeholder="At least 8 characters"/></label>
        {message && <p role="status" className="rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-3 text-xs leading-5 text-cyan-100">{message}</p>}
        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-60">{busy && <LoaderCircle size={16} className="animate-spin"/>}{mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      <p className="mt-6 text-center text-xs text-slate-500">{mode === "login" ? "New to CYBERX OS?" : "Already have an account?"} <button onClick={()=>{setMode(mode==="login"?"signup":"login");setMessage("");}} className="font-semibold text-cyan-300">{mode==="login"?"Create account":"Sign in"}</button></p>
      <Link href="/" className="mt-5 block text-center text-xs text-slate-600 hover:text-slate-300">← Back to overview</Link>
    </section>
  </main>;
}

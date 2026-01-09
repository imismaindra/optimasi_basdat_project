"use client";

import { type FormEvent, useState } from "react";

import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type RegisterFormState = {
  email: string;
  password: string;
  username: string;
};

type RegisterStatus = "idle" | "loading" | "success" | "error";

const defaultFormState: RegisterFormState = {
  email: "",
  password: "",
  username: "",
};

export default function RegisterPage() {
  const [formState, setFormState] = useState<RegisterFormState>(
    defaultFormState,
  );
  const [status, setStatus] = useState<RegisterStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    const email = formState.email.trim();
    const password = formState.password;
    const username = formState.username.trim();

    if (!email || !password || !username) {
      setStatus("error");
      setMessage("Email, password, dan username wajib diisi.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    if (!data.user) {
      setStatus("error");
      setMessage("Registrasi gagal: user tidak ditemukan.");
      return;
    }

    const profilePayload: Database["public"]["Tables"]["profiles"]["Insert"] = {
      id: data.user.id,
      username,
    };

    const { error: profileError } = await supabase
      .from("profiles")
      .insert(profilePayload);

    if (profileError) {
      if (!data.session) {
        setStatus("success");
        setMessage(
          "Akun dibuat. Silakan verifikasi email, lalu login untuk melengkapi profil.",
        );
        return;
      }
      setStatus("error");
      setMessage(profileError.message);
      return;
    }

    setStatus("success");
    setMessage("Registrasi berhasil. Silakan cek email jika perlu verifikasi.");
    setFormState(defaultFormState);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <main className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Daftar akun baru
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Buat akun Supabase dan otomatis simpan profil.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-zinc-700">
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={formState.email}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  email: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="block text-sm font-medium text-zinc-700">
            Username
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={formState.username}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  username: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
              placeholder="statusshare_user"
              maxLength={30}
              required
            />
          </label>

          <label className="block text-sm font-medium text-zinc-700">
            Password
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              value={formState.password}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  password: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
              placeholder="Minimal 6 karakter"
              minLength={6}
              required
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Memproses..." : "Daftar"}
          </button>
        </form>

        {message ? (
          <p
            className={`mt-4 text-sm ${
              status === "error" ? "text-red-600" : "text-emerald-600"
            }`}
          >
            {message}
          </p>
        ) : null}
      </main>
    </div>
  );
}

"use client";

import { useState } from "react";

/**
 * Field password dengan toggle tampilkan/sembunyikan.
 */
export function PasswordField() {
  const [show, setShow] = useState(false);

  return (
    <div className="group relative">
      <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-unit-3 -translate-y-1/2 text-[20px] text-outline transition-colors group-focus-within:text-primary-container">
        lock
      </span>
      <input
        id="password"
        name="password"
        type={show ? "text" : "password"}
        required
        autoComplete="current-password"
        placeholder="••••••••"
        className="font-body text-body-md w-full rounded-lg border border-outline-variant/30 bg-surface-container-low py-unit-3 pr-12 pl-11 transition-all placeholder:text-outline/50 focus:border-primary-container focus:ring-2 focus:ring-primary-container focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute top-1/2 right-unit-3 -translate-y-1/2 text-outline transition-colors hover:text-on-surface"
        aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
      >
        <span className="material-symbols-outlined text-[20px]">
          {show ? "visibility_off" : "visibility"}
        </span>
      </button>
    </div>
  );
}

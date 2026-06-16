"use client";

import { InputHTMLAttributes, useState } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({ style, ...props }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <input
        {...props}
        type={isVisible ? "text" : "password"}
        style={{
          ...style,
          paddingRight: "5.5rem",
        }}
      />
      <button
        type="button"
        aria-label={isVisible ? "Ocultar senha" : "Mostrar senha"}
        onClick={() => setIsVisible((current) => !current)}
        style={{
          position: "absolute",
          right: "0.75rem",
          top: "50%",
          transform: "translateY(-50%)",
          border: 0,
          background: "transparent",
          color: "inherit",
          cursor: "pointer",
          font: "inherit",
          fontSize: "0.85rem",
          fontWeight: 700,
          padding: 0,
        }}
      >
        {isVisible ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/new", label: "Новый сертификат" },
  { href: "/registry", label: "Реестр" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav
      className="app-nav no-print"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 20px",
        background: "#fff",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <span style={{ fontWeight: 700, marginRight: 16, color: "var(--accent)" }}>
        ШАҲОДАТНОМА
      </span>
      {links.map((l) => {
        const active = pathname === l.href || (l.href === "/new" && pathname === "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 500,
              fontSize: 14,
              color: active ? "#fff" : "var(--text)",
              background: active ? "var(--accent)" : "transparent",
            }}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

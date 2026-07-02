import type { Metadata } from "next";
import "./globals.css";
import "../styles/print.css";
import Nav from "../components/Nav";
import Toasts from "../components/Toast";

export const metadata: Metadata = {
  title: "Сертификаты — ШАҲОДАТНОМА",
  description: "Создание, печать и учёт сертификатов (Тоҷикстандарт)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Nav />
        <main>{children}</main>
        <Toasts />
      </body>
    </html>
  );
}

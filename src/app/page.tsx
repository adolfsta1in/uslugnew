import { redirect } from "next/navigation";

// По умолчанию открывается раздел «Новый сертификат».
export default function Home() {
  redirect("/new");
}

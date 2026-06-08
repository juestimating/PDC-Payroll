import { redirect } from "next/navigation";

export default function Home() {
  // The dashboard is the financial-story landing for signed-in users.
  redirect("/dashboard");
}

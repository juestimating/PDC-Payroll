import { redirect } from "next/navigation";

export default function Home() {
  // The cockpit Overview is the financial-story landing for signed-in users.
  redirect("/overview");
}

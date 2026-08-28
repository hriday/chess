import Link from "next/link";
import { getRequestUser } from "@/lib/auth/guards";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogoutButton } from "@/components/LogoutButton";

export async function Header() {
  const user = await getRequestUser();
  return (
    <header className="border-b border-black/10 dark:border-white/15">
      <nav className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-5 sm:gap-y-0 text-sm">
        <Link href="/" className="font-semibold text-base whitespace-nowrap">♞ chess.moosha.org</Link>
        <Link href="/famous" className="hover:underline whitespace-nowrap">Famous games</Link>
        {user && <Link href="/games" className="hover:underline whitespace-nowrap">My games</Link>}
        {user?.role === "admin" && <Link href="/admin" className="hover:underline whitespace-nowrap">Admin</Link>}
        <span className="ml-auto flex items-center gap-3 whitespace-nowrap">
          {user ? (<><span className="opacity-70 hidden sm:inline">{user.email}</span><LogoutButton /></>)
            : (<><Link href="/login" className="hover:underline">Log in</Link>
               <Link href="/signup" className="hover:underline">Sign up</Link></>)}
          <ThemeToggle />
        </span>
      </nav>
    </header>
  );
}

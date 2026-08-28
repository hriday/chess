"use client";

export function LogoutButton() {
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };
  return (
    <button onClick={logout} className="hover:underline">
      Log out
    </button>
  );
}

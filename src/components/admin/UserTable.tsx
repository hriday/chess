"use client";
import { useState, useEffect } from "react";

type Row = { id: string; email: string; role: string; isPaid: boolean; createdAt: string };

export function UserTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/admin/users").then(r => r.json()).then(b => setRows(b.users ?? []));
  }, []);
  const togglePaid = async (u: Row) => {
    setRows(rs => rs.map(r => r.id === u.id ? { ...r, isPaid: !u.isPaid } : r));
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPaid: !u.isPaid }),
      });
      if (!res.ok) throw new Error("not ok");
      setError(null);
    } catch {
      setRows(rs => rs.map(r => r.id === u.id ? { ...r, isPaid: u.isPaid } : r));
      setError(`Failed to update ${u.email}`);
    }
  };
  return (
    <div className="space-y-2">
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <table className="w-full text-sm">
        <thead><tr className="text-left opacity-60">
          <th className="py-1">Email</th><th>Role</th><th>Paid</th><th>Joined</th>
        </tr></thead>
        <tbody>
          {rows.map(u => (
            <tr key={u.id} className="border-t border-black/10 dark:border-white/15">
              <td className="py-1.5">{u.email}</td>
              <td>{u.role}</td>
              <td><input type="checkbox" checked={u.isPaid} onChange={() => togglePaid(u)} /></td>
              <td className="opacity-60">{new Date(u.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

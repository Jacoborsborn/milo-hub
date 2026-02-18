import { listClients } from "../../../../lib/services/clients";
import type { Client } from "../../../../types/database";
import Link from "next/link";

export default async function ClientsPage() {
  let clients: Client[];
  let error: string | null = null;

  try {
    clients = await listClients();
  } catch (err) {
    if ((err as any)?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    error = err instanceof Error ? err.message : "Failed to load clients";
    clients = [];
  }

  return (
    <div style={{ padding: "0 0 24px" }}>
      {error && (
        <div style={{ padding: 12, background: "#fee", color: "#c00", borderRadius: 4, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {!error && clients.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: "#666" }}>
          <p>No clients yet. Create your first client to get started.</p>
          <Link href="/pt/app/clients/new" style={{ display: "inline-block", marginTop: 12, padding: "8px 16px", background: "#0070f3", color: "white", textDecoration: "none", borderRadius: 4 }}>
            Create client
          </Link>
        </div>
      )}

      {!error && clients.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #ddd" }}>
              <th style={{ textAlign: "left", padding: 12 }}>Name</th>
              <th style={{ textAlign: "left", padding: 12 }}>Email</th>
              <th style={{ textAlign: "left", padding: 12 }}>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 12 }}>
                  <Link href={`/pt/app/clients/${client.id}`} style={{ color: "#0070f3", textDecoration: "none" }}>
                    {client.name}
                  </Link>
                </td>
                <td style={{ padding: 12, color: client.email ? "#333" : "#999" }}>
                  {client.email || "—"}
                </td>
                <td style={{ padding: 12, color: "#666" }}>
                  {new Date(client.updated_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 24 }}>
        <Link href="/pt/app" style={{ color: "#0070f3", textDecoration: "none" }}>← Back to Dashboard</Link>
      </div>
    </div>
  );
}

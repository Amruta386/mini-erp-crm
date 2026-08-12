import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, getErrorMessage } from "../api/client";

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState<any>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await api.get(`/customers/${id}`);
      setCustomer(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function addFollowUp(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    try {
      await api.post(`/customers/${id}/followups`, { note });
      setNote("");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (error) return <div className="error-banner">{error}</div>;
  if (!customer) return <p>Loading...</p>;

  return (
    <div>
      <Link to="/customers" className="muted">
        &larr; Back to customers
      </Link>
      <div className="page-header">
        <h2>{customer.name}</h2>
        <span className={`badge badge-${customer.status.toLowerCase()}`}>{customer.status}</span>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="form-grid">
          <div>
            <strong>Mobile:</strong> {customer.mobile}
          </div>
          <div>
            <strong>Email:</strong> {customer.email || "-"}
          </div>
          <div>
            <strong>Business:</strong> {customer.businessName || "-"}
          </div>
          <div>
            <strong>GST:</strong> {customer.gstNumber || "-"}
          </div>
          <div>
            <strong>Type:</strong> {customer.customerType}
          </div>
          <div>
            <strong>Address:</strong> {customer.address || "-"}
          </div>
        </div>
        {customer.notes && (
          <p style={{ marginTop: 12 }}>
            <strong>Notes:</strong> {customer.notes}
          </p>
        )}
      </div>

      <h3>Follow-ups</h3>
      <form onSubmit={addFollowUp} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="Add a follow-up note..." value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn btn-primary">Add</button>
        </div>
      </form>

      <div className="stack">
        {customer.followUps?.length ? (
          customer.followUps.map((f: any) => (
            <div key={f.id} className="card">
              <div className="spaced">
                <strong>{f.createdBy?.name}</strong>
                <span className="muted">{new Date(f.createdAt).toLocaleString()}</span>
              </div>
              <p style={{ margin: "8px 0 0" }}>{f.note}</p>
            </div>
          ))
        ) : (
          <p className="muted">No follow-ups yet.</p>
        )}
      </div>
    </div>
  );
}

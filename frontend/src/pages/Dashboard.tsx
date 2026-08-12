import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getErrorMessage } from "../api/client";

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/dashboard/summary")
      .then((res) => setSummary(res.data))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  if (error) return <div className="error-banner">{error}</div>;
  if (!summary) return <p>Loading...</p>;

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div className="muted">Customers</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{summary.customers.total}</div>
          <div className="muted">{summary.customers.leads} leads · {summary.customers.active} active</div>
        </div>
        <div className="card">
          <div className="muted">Products</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{summary.products.total}</div>
          <div className="muted">
            {summary.products.lowStock > 0 ? (
              <Link to="/products" style={{ color: "var(--danger)" }}>
                {summary.products.lowStock} low on stock
              </Link>
            ) : (
              "All stock levels healthy"
            )}
          </div>
        </div>
        <div className="card">
          <div className="muted">Challans</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{summary.challans.confirmedToday}</div>
          <div className="muted">confirmed today · {summary.challans.drafts} drafts pending</div>
        </div>
        <div className="card">
          <div className="muted">Revenue this month</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>₹{summary.revenueThisMonth.toLocaleString("en-IN")}</div>
          <div className="muted">from confirmed challans</div>
        </div>
      </div>

      {summary.products.lowStock > 0 && (
        <div className="card" style={{ borderColor: "var(--warning)" }}>
          <strong>⚠ {summary.products.lowStock} product(s) at or below minimum stock.</strong>{" "}
          <Link to="/products">Review stock levels →</Link>
        </div>
      )}
    </div>
  );
}

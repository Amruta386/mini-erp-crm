import { useEffect, useState } from "react";
import { api, getErrorMessage } from "../api/client";

interface LineItem {
  productId: string;
  quantity: string;
}

export default function Challans() {
  const [challans, setChallans] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ productId: "", quantity: "1" }]);

  async function loadChallans() {
    try {
      const res = await api.get("/challans");
      setChallans(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function loadRefData() {
    const [c, p] = await Promise.all([api.get("/customers", { params: { limit: 100 } }), api.get("/products", { params: { limit: 100 } })]);
    setCustomers(c.data.data);
    setProducts(p.data.data);
  }

  useEffect(() => {
    loadChallans();
    loadRefData();
  }, []);

  function updateItem(idx: number, field: keyof LineItem, value: string) {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value };
    setItems(next);
  }

  function addItemRow() {
    setItems([...items, { productId: "", quantity: "1" }]);
  }

  function removeItemRow(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  async function submit(status: "DRAFT" | "CONFIRMED") {
    setError("");
    if (!customerId) return setError("Select a customer");
    const validItems = items.filter((i) => i.productId && Number(i.quantity) > 0);
    if (validItems.length === 0) return setError("Add at least one product");

    try {
      await api.post("/challans", {
        customerId,
        status,
        items: validItems.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
      });
      setShowForm(false);
      setCustomerId("");
      setItems([{ productId: "", quantity: "1" }]);
      loadChallans();
      loadRefData(); // refresh stock numbers if confirmed
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function confirmChallan(id: string) {
    setError("");
    try {
      await api.patch(`/challans/${id}/confirm`);
      loadChallans();
      loadRefData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function downloadPdf(id: string, challanNumber: string) {
    setError("");
    try {
      const res = await api.get(`/challans/${id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      window.open(url, "_blank");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function cancelChallan(id: string) {
    setError("");
    try {
      await api.patch(`/challans/${id}/cancel`);
      loadChallans();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Sales Challans</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Close" : "+ New Challan"}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3>New Sales Challan</h3>
          <label>Customer *</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.mobile})
              </option>
            ))}
          </select>

          <div style={{ marginTop: 16 }}>
            <label>Products</label>
            {items.map((item, idx) => {
              const product = products.find((p) => p.id === item.productId);
              return (
                <div className="item-row" key={idx}>
                  <select value={item.productId} onChange={(e) => updateItem(idx, "productId", e.target.value)}>
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) — stock: {p.stock}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                    placeholder="Qty"
                  />
                  <div className="muted">{product ? `₹${product.unitPrice} / unit` : ""}</div>
                  <button type="button" className="btn btn-sm" onClick={() => removeItemRow(idx)}>
                    Remove
                  </button>
                </div>
              );
            })}
            <button type="button" className="btn btn-sm" onClick={addItemRow}>
              + Add product line
            </button>
          </div>

          <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => submit("DRAFT")}>
              Save as Draft
            </button>
            <button className="btn btn-primary" onClick={() => submit("CONFIRMED")}>
              Confirm &amp; Reduce Stock
            </button>
          </div>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Challan #</th>
            <th>Customer</th>
            <th>Total Qty</th>
            <th>Status</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {challans.map((c) => (
            <tr key={c.id}>
              <td>{c.challanNumber}</td>
              <td>{c.customer?.name}</td>
              <td>{c.totalQuantity}</td>
              <td>
                <span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span>
              </td>
              <td>{new Date(c.createdAt).toLocaleDateString()}</td>
              <td style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-sm" onClick={() => downloadPdf(c.id, c.challanNumber)}>
                  PDF
                </button>
                {c.status === "DRAFT" && (
                  <>
                    <button className="btn btn-sm" onClick={() => confirmChallan(c.id)}>
                      Confirm
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => cancelChallan(c.id)}>
                      Cancel
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {challans.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                No challans yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

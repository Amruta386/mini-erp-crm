import { useEffect, useState } from "react";
import { api, getErrorMessage } from "../api/client";

interface Product {
  id: string;
  name: string;
  sku: string;
  category?: string;
  unitPrice: string;
  stock: number;
  minStock: number;
  location?: string;
}

const emptyForm = { name: "", sku: "", category: "", unitPrice: "0", minStock: "0", location: "" };
const emptyMovement = { quantity: "1", movementType: "IN", reason: "" };

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [movementFor, setMovementFor] = useState<string | null>(null);
  const [movement, setMovement] = useState(emptyMovement);

  async function load() {
    try {
      const res = await api.get("/products", { params: { search, lowStock: lowStock || undefined } });
      setProducts(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, lowStock]);

  function startAdd() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(p: Product) {
    setForm({ ...p, unitPrice: String(p.unitPrice), minStock: String(p.minStock) } as any);
    setEditingId(p.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const payload = { ...form, unitPrice: Number(form.unitPrice), minStock: Number(form.minStock) };
    try {
      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
      } else {
        await api.post("/products", payload);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function submitMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!movementFor) return;
    setError("");
    try {
      await api.post(`/products/${movementFor}/stock-movement`, {
        quantity: Number(movement.quantity),
        movementType: movement.movementType,
        reason: movement.reason,
      });
      setMovementFor(null);
      setMovement(emptyMovement);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Products &amp; Stock</h2>
        <button className="btn btn-primary" onClick={startAdd}>
          + Add Product
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <input placeholder="Search by name or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 0 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} />
          Low stock only
        </label>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3>{editingId ? "Edit Product" : "New Product"}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div>
                <label>Name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label>SKU *</label>
                <input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} disabled={!!editingId} />
              </div>
              <div>
                <label>Category</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
              <div>
                <label>Unit Price *</label>
                <input required type="number" min="0" step="0.01" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
              </div>
              <div>
                <label>Minimum Stock Alert Qty</label>
                <input type="number" min="0" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
              </div>
              <div>
                <label>Location / Warehouse</label>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
            </div>
            {!editingId && <p className="muted">Initial stock starts at 0 — use "Stock movement" after creating to add opening stock.</p>}
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <button className="btn btn-primary">Save</button>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {movementFor && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3>Record Stock Movement</h3>
          <form onSubmit={submitMovement}>
            <div className="form-grid">
              <div>
                <label>Movement Type</label>
                <select value={movement.movementType} onChange={(e) => setMovement({ ...movement, movementType: e.target.value })}>
                  <option value="IN">IN</option>
                  <option value="OUT">OUT</option>
                </select>
              </div>
              <div>
                <label>Quantity</label>
                <input type="number" min="1" value={movement.quantity} onChange={(e) => setMovement({ ...movement, quantity: e.target.value })} />
              </div>
            </div>
            <label>Reason *</label>
            <input required value={movement.reason} onChange={(e) => setMovement({ ...movement, reason: e.target.value })} placeholder="e.g. Purchase order received, stock correction..." />
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <button className="btn btn-primary">Submit</button>
              <button type="button" className="btn" onClick={() => setMovementFor(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>SKU</th>
            <th>Category</th>
            <th>Unit Price</th>
            <th>Stock</th>
            <th>Location</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.sku}</td>
              <td>{p.category || "-"}</td>
              <td>₹{p.unitPrice}</td>
              <td>
                {p.stock}
                {p.stock <= p.minStock && (
                  <span className="badge badge-lead" style={{ marginLeft: 6 }}>
                    Low
                  </span>
                )}
              </td>
              <td>{p.location || "-"}</td>
              <td style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-sm" onClick={() => startEdit(p)}>
                  Edit
                </button>
                <button className="btn btn-sm" onClick={() => setMovementFor(p.id)}>
                  Stock movement
                </button>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">
                No products found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

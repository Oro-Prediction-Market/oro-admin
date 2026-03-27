import React, { useState } from "react"

interface MarketFormProps {
  initialData?: any
  onSubmit: (data: any) => void
  onCancel: () => void
  loading?: boolean
}

const MarketForm: React.FC<MarketFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  loading,
}) => {
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    description: initialData?.description || "",
    outcomes: initialData?.outcomes?.map((o: any) => o.label) || ["Yes", "No"],
    opensAt: initialData?.opensAt
      ? new Date(initialData.opensAt).toISOString().slice(0, 16)
      : "",
    closesAt: initialData?.closesAt
      ? new Date(initialData.closesAt).toISOString().slice(0, 16)
      : "",
    houseEdgePct: initialData?.houseEdgePct || 5,
    mechanism: initialData?.mechanism || "parimutuel",
    liquidityParam: initialData?.liquidityParam || 1000,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleOutcomeChange = (index: number, value: string) => {
    const newOutcomes = [...formData.outcomes]
    newOutcomes[index] = value
    setFormData((prev) => ({ ...prev, outcomes: newOutcomes }))
  }

  const addOutcome = () => {
    setFormData((prev) => ({ ...prev, outcomes: [...prev.outcomes, ""] }))
  }

  const removeOutcome = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      outcomes: prev.outcomes.filter((_: string, i: number) => i !== index),
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      houseEdgePct: Number(formData.houseEdgePct),
      liquidityParam: Number(formData.liquidityParam),
    })
  }

  return (
    <div className="glass-card" style={{ maxWidth: "600px", margin: "0 auto" }}>
      <form onSubmit={handleSubmit}>
        <h3>{initialData ? "Edit Market" : "Create New Market"}</h3>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.75rem", color: "hsl(var(--muted-foreground))" }}>TITLE</label>
          <input
            name="title"
            value={formData.title}
            onChange={handleChange}
            className="input-field"
            required
            placeholder="e.g., Will BTC reach $100k?"
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.75rem", color: "hsl(var(--muted-foreground))" }}>DESCRIPTION</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="input-field"
            style={{ minHeight: "80px", resize: "vertical" }}
            placeholder="Market details..."
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.75rem", color: "hsl(var(--muted-foreground))" }}>OUTCOMES</label>
          {formData.outcomes.map((outcome: string, index: number) => (
            <div key={index} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <input
                value={outcome}
                onChange={(e) => handleOutcomeChange(index, e.target.value)}
                className="input-field"
                style={{ marginBottom: 0 }}
                required
                placeholder={`Outcome ${index + 1}`}
              />
              {formData.outcomes.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOutcome(index)}
                  className="secondary"
                  style={{ padding: "0 0.75rem" }}
                >
                  &times;
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addOutcome} className="secondary" style={{ width: "100%", fontSize: "0.75rem" }}>
            + Add Outcome
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
           <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.75rem", color: "hsl(var(--muted-foreground))" }}>OPENS AT</label>
              <input
                type="datetime-local"
                name="opensAt"
                value={formData.opensAt}
                onChange={handleChange}
                className="input-field"
                required
              />
           </div>
           <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.75rem", color: "hsl(var(--muted-foreground))" }}>CLOSES AT</label>
              <input
                type="datetime-local"
                name="closesAt"
                value={formData.closesAt}
                onChange={handleChange}
                className="input-field"
                required
              />
           </div>
        </div>


        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.75rem", color: "hsl(var(--muted-foreground))" }}>HOUSE EDGE (%)</label>
          <input
            type="number"
            name="houseEdgePct"
            value={formData.houseEdgePct}
            onChange={handleChange}
            className="input-field"
            min="0"
            max="100"
            required
          />
        </div>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={loading}>
            {loading ? "Saving..." : initialData ? "Update Market" : "Create Market"}
          </button>
        </div>
      </form>
    </div>
  )
}

export default MarketForm

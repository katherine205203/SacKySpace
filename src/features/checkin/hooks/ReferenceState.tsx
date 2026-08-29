export function ReferenceState({ error }: { error: string | null }) {
  if (!error) return <p className="loading-state">Đang tải dữ liệu tham chiếu…</p>
  return <p className="form-error" role="alert">Không thể tải dữ liệu tham chiếu: {error}</p>
}

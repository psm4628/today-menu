// 삭제 같은 되돌릴 수 없는 동작 전에 확인을 받는 창. message 는 글자로만 표시한다.
export default function ConfirmDialog({ title, message, error, busy, onConfirm, onCancel }) {
  return (
    <div className="overlay" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="dialog">
        <h2>{title}</h2>
        <p className="confirm-message">{message}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="actions">
          <button onClick={onCancel} disabled={busy}>취소</button>
          <button className="danger" onClick={onConfirm} disabled={busy}>{busy ? "삭제 중…" : "삭제"}</button>
        </div>
      </div>
    </div>
  );
}

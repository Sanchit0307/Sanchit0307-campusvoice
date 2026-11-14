import './DeleteConfirmationModal.css'

function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  ideaTitle = '',
  isDeleting = false,
  error = null,
}) {
  if (!isOpen) return null

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isDeleting) {
      onClose()
    }
  }

  return (
    <div
      className="delete-modal-backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="delete-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        aria-describedby="delete-modal-description"
      >
        <button
          type="button"
          className="delete-modal-close-btn"
          onClick={onClose}
          disabled={isDeleting}
          aria-label="Close deletion dialog"
        >
          &times;
        </button>

        <div className="delete-modal-icon-badge" aria-hidden="true">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </div>

        <h2 id="delete-modal-title" className="delete-modal-title">
          Remove Proposal
        </h2>

        <p id="delete-modal-description" className="delete-modal-description">
          Are you sure you want to permanently remove{' '}
          <strong className="delete-modal-target-title">
            {ideaTitle ? `"${ideaTitle}"` : 'this proposal'}
          </strong>
          ? All associated student votes will also be deleted. This action cannot be undone.
        </p>

        {error && (
          <div className="delete-modal-error" role="alert">
            <span>⚠️ {error}</span>
          </div>
        )}

        <div className="delete-modal-actions">
          <button
            type="button"
            className="btn btn-secondary delete-modal-cancel-btn"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger delete-modal-confirm-btn"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Removing...' : 'Delete Proposal'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteConfirmationModal

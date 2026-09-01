import Modal from '../Modal/Modal.jsx';
import Button from '../Button/Button.jsx';

/**
 * ConfirmDialog — built on Modal.
 *
 * Props:
 *   open, onClose, onConfirm,
 *   title, message,
 *   confirmText, cancelText,
 *   tone: 'normal' | 'danger'   — danger renders a red confirm button
 *   loading: disables buttons while async action is in flight
 */
function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  tone = 'normal',
  loading = false,
}) {
  const handleConfirm = () => {
    if (loading) return;
    onConfirm?.();
  };

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={handleConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      {message ? <p style={{ margin: 0 }}>{message}</p> : null}
    </Modal>
  );
}

export default ConfirmDialog;
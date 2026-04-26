import './AccessWall.css';
import { useAuth } from '../context/AuthContext';

export default function AccessWall({ type, sectionLabel, onLoginClick }) {
  const { currentUser, logout } = useAuth();

  const renderContent = () => {
    switch (type) {
      case 'login':
        return (
          <div className="access-card login-wall fade-in">
            <div className="access-icon-wrapper">
              <span className="access-icon">🔒</span>
            </div>
            <h2 className="access-title">Members Only Content</h2>
            <p className="access-text">
              Access to <strong>{sectionLabel}</strong> requires a verified account. 
              Please login or join our community to continue.
            </p>
            <div className="access-actions">
              <button className="access-btn primary" onClick={onLoginClick}>
                Login to View
              </button>
            </div>
          </div>
        );

      case 'pending':
        return (
          <div className="access-card pending-wall fade-in">
            <div className="access-icon-wrapper pulse-bg">
              <span className="access-icon">⏳</span>
            </div>
            <h2 className="access-title">Account Pending Approval</h2>
            <p className="access-text">
              Your registration for <strong>{currentUser?.phoneNumber || 'Member'}</strong> is currently under review.
              You will gain access to <strong>{sectionLabel}</strong> once an administrator verifies your account.
            </p>
            <div className="access-info-box">
              <span className="info-label">Current Status:</span>
              <span className="info-value status-pending">Awaiting Verification</span>
            </div>
            <div className="access-actions">
              <button className="access-btn secondary" onClick={logout}>
                Logout / Switch Account
              </button>
            </div>
          </div>
        );

      case 'rejected':
        return (
          <div className="access-card rejected-wall fade-in">
            <div className="access-icon-wrapper error-bg">
              <span className="access-icon">🚫</span>
            </div>
            <h2 className="access-title">Access Denied</h2>
            <p className="access-text">
              Sorry, your account application was not approved for viewing protected segments like <strong>{sectionLabel}</strong>.
            </p>
            <div className="access-actions">
              <button className="access-btn alert" onClick={logout}>
                Logout
              </button>
            </div>
          </div>
        );

      case 'admin-only':
         return (
          <div className="access-card admin-wall fade-in">
            <div className="access-icon-wrapper lock-bg">
              <span className="access-icon">🔐</span>
            </div>
            <h2 className="access-title">Admin Access Required</h2>
            <p className="access-text">
              The Management Portal is reserved for authorized personnel. 
              Please log in with an administrator account to manage <strong>{sectionLabel}</strong>.
            </p>
            <div className="access-actions">
              <button className="access-btn primary" onClick={onLoginClick}>
                Identification Required
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="access-wall-container">
      {renderContent()}
    </div>
  );
}

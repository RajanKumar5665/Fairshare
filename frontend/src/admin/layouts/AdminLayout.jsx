import Brand from '../components/Brand';

export default function AdminLayout({ user, onLogout, children }) {
  return (
    <div className="admin-app">
      <aside className="sidebar">
        <Brand />
        <nav className="sidebar-nav">
          <a className="nav-link active" href="#dashboard">Overview</a>
          <a className="nav-link" href="#rooms">Rooms & members</a>
        </nav>
        <div className="sidebar-footer">
          <div className="admin-identity"><span className="avatar">{user.name?.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><small>Platform admin</small></div></div>
          <button className="logout-button" onClick={onLogout}><span>Sign out</span></button>
        </div>
      </aside>
      <div className="content-shell">
        <header className="mobile-header"><Brand /><button className="logout-button" onClick={onLogout}>Sign out</button></header>
        {children}
        <nav className="mobile-nav" aria-label="Admin navigation">
          <a href="#dashboard">Overview</a>
          <a href="#rooms">Rooms</a>
        </nav>
      </div>
    </div>
  );
}

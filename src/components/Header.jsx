import './Header.css';

export default function Header() {
  return (
    <header className="header">
      <a className="header-logo" href="https://naturescradle.com" target="_blank" rel="noreferrer">
        <div className="logo-leaf" />
        <div className="logo-text">
          <strong>Nature's Cradle</strong>
          <span>Nursery &amp; Landscape Design</span>
        </div>
      </a>
      <span className="header-tagline">55 Mill Road, Eastchester NY · (914) 779-8723</span>
    </header>
  );
}

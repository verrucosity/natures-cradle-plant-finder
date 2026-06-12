import './Footer.css';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-logo-row">
            <div className="footer-leaf" />
            <span className="footer-name">Nature's Cradle</span>
          </div>
          <p className="footer-tag">Nursery &amp; Landscape Design</p>
        </div>

        <div className="footer-col">
          <span className="footer-col-title">Visit Us</span>
          <p>55 Mill Road<br />Eastchester, NY 10709</p>
        </div>

        <div className="footer-col">
          <span className="footer-col-title">Get in Touch</span>
          <p>
            <a href="tel:+19147798723">(914) 779-8723</a><br />
            Stop by or give us a call — we'll help you find the right plants.
          </p>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Nature's Cradle Nursery &amp; Landscape Design</span>
        <span className="footer-note">Prices and availability subject to change</span>
      </div>
    </footer>
  );
}

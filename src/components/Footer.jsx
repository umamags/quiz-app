export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <span>&copy; {new Date().getFullYear()} Mahesh Natarajan</span>
        <nav className="footer-links">
          <a href="/quiz-app/" target="_blank" rel="noopener noreferrer">
            Quiz App
          </a>
          <a href="/trains/" target="_blank" rel="noopener noreferrer">
            Trains
          </a>
          <a href="/countries/" target="_blank" rel="noopener noreferrer">
            Countries
          </a>
          <a href="/temples/" target="_blank" rel="noopener noreferrer">
            Temples
          </a>
        </nav>
      </div>
    </footer>
  )
}

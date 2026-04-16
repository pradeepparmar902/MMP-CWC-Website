import './ContentArea.css';

export default function ContentArea({ activeSection }) {
  // Format the title nicely
  const title = activeSection === 'meghpush' ? 'MeghPush (News)' : 
                activeSection === 'election' ? 'Election Card' : 
                activeSection === 'samaj' ? 'Samaj Jog Sandesh' :
                activeSection.charAt(0).toUpperCase() + activeSection.slice(1);

  return (
    <section className="content-area container fade-in" key={activeSection}>
      <h3 className="section-title">{title}</h3>
      <div className="placeholder-content">
        <span className="construction-icon">🚧</span>
        <p>Under Development</p>
      </div>
    </section>
  );
}

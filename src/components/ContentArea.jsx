import { getDirectUrl, getOpenUrl } from '../utils/assetUtils';
import SamajJogSandesh from './SamajJogSandesh';
import Education from './Education';
import SectionPage from './SectionPage';
import './ContentArea.css';

const SECTION_MAP = {
  education: 'Education',
  matrimony: 'Matrimony',
  meghpush: 'MeghPush',
  election: 'Election',
  samaj: 'Samaj',
  home: 'General',
};

export default function ContentArea({ activeSection, assets = [], language }) {
  // Format the title nicely
  const title = activeSection === 'meghpush' ? 'MeghPush (News)' : 
                activeSection === 'election' ? 'Election Card' : 
                activeSection === 'samaj' ? 'Samaj Jog Sandesh' :
                activeSection.charAt(0).toUpperCase() + activeSection.slice(1);

  const categoryKey = SECTION_MAP[activeSection] || null;
  const sectionAssets = categoryKey
    ? assets.filter(a => a.category === categoryKey)
    : [];

  return (
    <section 
      className={`content-area ${ (activeSection !== 'samaj' && activeSection !== 'education') ? 'container' : 'panorama-view'} fade-in`} 
      key={activeSection}
    >
      <h3 className="section-title">{title}</h3>

      {activeSection === 'samaj' ? (
        <SamajJogSandesh lang={language} />
      ) : activeSection === 'education' ? (
        <Education />
      ) : activeSection === 'matrimony' ? (
        <SectionPage
          collectionName="matrimony_posts"
          bilingual={true}
          adminRoles={['isSuperAdmin']}
        />
      ) : activeSection === 'meghpush' ? (
        <SectionPage
          collectionName="meghpush_posts"
          bilingual={true}
          adminRoles={['isSuperAdmin']}
        />
      ) : activeSection === 'election' ? (
        <SectionPage
          collectionName="election_posts"
          bilingual={true}
          adminRoles={['isSuperAdmin']}
        />
      ) : sectionAssets.length > 0 ? (
        <div className="content-assets-grid">
          {sectionAssets.map(asset => (
            <a
              key={asset.id}
              href={getOpenUrl(asset.url)}
              target="_blank"
              rel="noreferrer"
              className="content-asset-card"
            >
              <div className="asset-card-icon">
                {asset.type === 'pdf' ? '📄' : asset.type === 'image' ? '🖼️' : '🔗'}
              </div>
              <div className="asset-card-body">
                <span className="asset-card-title">{asset.title}</span>
                {asset.description && <p className="asset-card-desc">{asset.description}</p>}
              </div>
              <span className="asset-card-open">Open →</span>
            </a>
          ))}
        </div>
      ) : (
        <div className="placeholder-content">
          <span className="construction-icon">🚧</span>
          <p>Under Development</p>
          <p className="placeholder-hint">Add content for this section from the <strong>Admin</strong> panel.</p>
        </div>
      )}
    </section>
  );
}

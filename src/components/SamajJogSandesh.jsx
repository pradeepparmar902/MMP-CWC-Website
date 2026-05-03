// Thin wrapper — Samaj Jog Sandesh uses the shared SectionPage with its specific config
import SectionPage from './SectionPage';

export default function SamajJogSandesh({ lang }) {
  return (
    <SectionPage
      lang={lang}
      collectionName="samaj_jog_sandesh"
      bilingual={true}
      adminRoles={['isSamajAdmin', 'isSuperAdmin']}
    />
  );
}

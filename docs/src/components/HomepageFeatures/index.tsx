import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  href: string;
  description: ReactNode;
  label: string;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Vision produit',
    label: 'Produit',
    href: '/docs/vision-produit',
    description: (
      <>
        Comprendre le rôle de Batmobile dans l’écosystème Data-Driven, les publics
        visés et les objectifs métier couverts par la première version.
      </>
    ),
  },
  {
    title: 'Démarrage local',
    label: 'Installation',
    href: '/docs/demarrage-local',
    description: (
      <>
        Installer les dépendances, lancer l’application Angular et démarrer le site
        de documentation sans friction.
      </>
    ),
  },
  {
    title: 'Architecture technique',
    label: 'Technique',
    href: '/docs/architecture-technique',
    description: (
      <>
        Explorer les routes, les services de session, l’intégration Firebase et la
        composition Angular/Ionic de l’application.
      </>
    ),
  },
  {
    title: 'Modules métier',
    label: 'Fonctionnel',
    href: '/docs/modules-metier',
    description: (
      <>
        Parcourir les quiz, l’historique, les statistiques, le système de succès et
        le profil utilisateur à partir du code existant.
      </>
    ),
  },
  {
    title: 'Contribution',
    label: 'Process',
    href: '/docs/contribution',
    description: (
      <>
        Les repères utiles pour contribuer proprement: conventions, tests et points
        d’attention quand la documentation évolue.
      </>
    ),
  },
];

function Feature({title, href, label, description}: FeatureItem) {
  return (
    <Link className={styles.card} to={href}>
      <div className={styles.cardTag}>{label}</div>
      <Heading as="h3" className={styles.cardTitle}>
        {title}
      </Heading>
      <p className={styles.cardDescription}>{description}</p>
      <span className={styles.cardLink}>Ouvrir la page</span>
    </Link>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className={styles.grid}>
        {FeatureList.map((props) => (
          <Feature key={props.title} {...props} />
        ))}
      </div>
    </section>
  );
}

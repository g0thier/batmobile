import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

import styles from './index.module.css';

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();

  return (
    <Layout
      title={siteConfig.title}
      description="Documentation du projet Batmobile, le compagnon mobile de la plateforme Data-Driven.">
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <p className={styles.eyebrow}>Documentation produit et technique</p>
            <Heading as="h1" className={styles.title}>
              {siteConfig.title}
            </Heading>
            <p className={styles.subtitle}>{siteConfig.tagline}</p>
            <p className={styles.summary}>
              Cette documentation présente le périmètre fonctionnel de Batmobile, son architecture Angular
              et Ionic, ainsi que les modules métier qui pilotent les quiz, l’historique, les succès et le
              profil utilisateur.
            </p>
            <div className={styles.actions}>
              <Link className="button button--primary button--lg" to="/docs/intro">
                Lire la documentation
              </Link>
              <Link className="button button--secondary button--lg" to="/docs/architecture-technique">
                Voir l’architecture
              </Link>
            </div>
          </div>
        </section>
        <section className={styles.section}>
          <div className="container">
            <div className={styles.sectionHeading}>
              <p className={styles.sectionKicker}>Par où commencer</p>
              <Heading as="h2">Les pages utiles tout de suite</Heading>
            </div>
            <HomepageFeatures />
          </div>
        </section>
      </main>
    </Layout>
  );
}

import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Batmobile',
  tagline: 'Documentation du compagnon mobile Data-Driven',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  url: 'https://batmobile.example.com',
  baseUrl: '/',

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Batmobile',
      items: [
        {
          to: '/docs/intro',
          label: 'Documentation',
          position: 'left',
        },
        {to: '/docs/architecture-technique', label: 'Architecture', position: 'left'},
        {to: '/docs/contribution', label: 'Contribuer', position: 'right'},
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Accueil',
              to: '/docs/intro',
            },
            {
              label: 'Vision produit',
              to: '/docs/vision-produit',
            },
            {
              label: 'Architecture',
              to: '/docs/architecture-technique',
            },
            {
              label: 'Modules métier',
              to: '/docs/modules-metier',
            },
            {
              label: 'Contribution',
              to: '/docs/contribution',
            },
          ],
        },
        {
          title: 'Mise en route',
          items: [
            {
              label: 'Démarrage local',
              to: '/docs/demarrage-local',
            },
            {
              label: 'Accueil',
              to: '/docs/intro',
            },
          ],
        },
        {
          title: 'Projet',
          items: [
            {
              label: 'Batmobile',
              href: 'https://github.com/g0thier/datadriven',
            },
            {
              label: 'Angular',
              href: 'https://angular.dev/',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Batmobile. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

# Batmobile Companion App

Batmobile is the companion application of the Data-Driven project:
- [g0thier/datadriven](https://github.com/g0thier/datadriven)

## Description

This repository represents the mobile-oriented companion layer of the Data-Driven management ecosystem.  
It starts with the **Motivation** module inside the Human Resources management domain.

In this context, motivation is treated as a strategic lever for:
- employee retention,
- retention of organizational know-how and knowledge,
- and the first step in building robust company objectives across support functions, key success factors, marketing mix, and finance.

The current codebase is in an Angular starter phase while the product foundation is being structured.

## Table of Contents

- [Batmobile Companion App](#batmobile-companion-app)
  - [Description](#description)
  - [Table of Contents](#table-of-contents)
  - [Objective](#objective)
  - [Target Audience](#target-audience)
  - [Current Modules](#current-modules)
  - [Repository Structure](#repository-structure)
  - [Installation](#installation)
  - [Available Scripts](#available-scripts)
  - [Roadmap](#roadmap)
  - [Security](#security)
  - [Changelog](#changelog)
  - [Contributing](#contributing)
  - [License](#license)
  - [Author](#author)

## Objective

Provide the companion-app foundation for Data-Driven modules, beginning with HR motivation workflows that strengthen long-term organizational performance.

## Target Audience

- Employees working under C-level leaders using the Data-Driven SaaS
- HR and people operations teams supporting C-level strategy execution
- Managers responsible for employee engagement and capability development

## Current Modules

- `Motivation`: first module focused on motivation dynamics as a retention and strategic alignment driver

## Repository Structure

```text
batmobile/
├── public/
│   └── favicon.ico
├── src/
│   ├── app/
│   │   ├── app.config.ts
│   │   ├── app.css
│   │   ├── app.html
│   │   ├── app.routes.ts
│   │   ├── app.spec.ts
│   │   └── app.ts
│   ├── index.html
│   ├── main.ts
│   └── styles.css
├── angular.json
├── package.json
└── README.md
```

## Installation

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run start
```

## Available Scripts

```bash
npm run start   # Start Angular dev server
npm run build   # Build production assets
npm run watch   # Build in watch mode for development
npm run test    # Run unit tests
npm run screenshots # Capture Angular pages into docs/images
```

The screenshot script uses Playwright and expects login credentials when capturing protected
pages. You can provide them through `.env.local` or shell variables such as:

```bash
SCREENSHOT_AUTH_EMAIL=you@example.com
SCREENSHOT_AUTH_PASSWORD=your-password
```

Before the first run, install the Chromium browser used by Playwright:

```bash
npx playwright install chromium
```

## Roadmap

- `Motivation` (current): HR motivation and retention foundation
- `Support Functions` (next): support-business alignment workflows
- `Key Success Factors` (next): operationalization of strategic success criteria
- `Marketing Mix` (next): structured market and offer alignment tools
- `Finance` (next): financial perspective integration for strategic consistency

## Security

Security reporting process is documented in [SECURITY.md](SECURITY.md).

## Changelog

Project changes are tracked in [CHANGELOG.md](CHANGELOG.md).

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

License details are available in [LICENSE.md](LICENSE.md).

## Author

Gauthier Rammault

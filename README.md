# Asset Management System

This project is an Asset Management System designed to help organizations manage their assets efficiently. It includes features like assigning assets to users, updating asset information, unassigning assets, and filtering assets based on various criteria. The application is built with Next.js, React, and Prisma for the database interactions.

This is build using [Next.js](https://nextjs.org/), [Prisma](https://prisma.io/), [PostgreSQL](https://postgresql.org/) and [NextUI](https://nextui.org/)

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Asset Management**: Add, update, assign, and unassign assets.
- **User Management**: Assign users to assets and manage user information.
- **Filtering and Sorting**: Filter assets by various criteria and sort them as needed.
- **Pagination**: Efficiently handle large datasets with pagination.
- **Column Controls**: Toggle column visibility, apply per-column select filters, and choose page size (25/50/100) directly in any table toolbar.
- **Row Actions**: Dropdown menus on asset rows consolidate view/edit/delete, user assignment, and QR-code display.
- **Create Flows**: Dedicated creation screens exist for assets, accessories, consumables, licences, locations, manufacturers, suppliers, and users.
- **Responsive Design**: Fully responsive design for mobile and desktop views.
- **Search Functionality**: Quickly search for assets using the search bar.
- **User Onboarding**: Intuitive user onboarding with guided tours and tooltips.
- **Accessibility**: Designed with accessibility in mind.

## Installation

To get started with the project, clone the repository and install the dependencies:

```bash
git clone https://github.com/your-username/asset-management-system.git
cd asset-management-system

npm install
yarn install
pnpm install
bun install

npm run dev
yarn dev
pnpm dev
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

Rename the example.env and fill in you Data

```bash
DATABASE_URL="postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public"
```

## Prisma

```bash
npx prisma init

npx prisma generate

npx prisma migrate dev --name init
```

## usage

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/accessories` | Create an accessory (requires manufacturer, model, status, category, location, supplier). |
| POST | `/api/asset` | Create an asset with optional model/category/location/supplier/manufacturer metadata. |
| POST | `/api/consumable` | Create a consumable record. |
| POST | `/api/licence` | Create a licence and optionally assign it to a user. |
| POST | `/api/location` | Create a location entry (name required, address optional). |
| POST | `/api/manufacturer` | Create a manufacturer entry. |
| POST | `/api/supplier` | Create a supplier entry with optional contact information. |
| POST | `/api/user/addUser` | Create a user with admin/requester flags. |
| POST | `/api/userAssets/assign` | Assign an asset to a user. |
| POST | `/api/userAccessoires/assign` | Assign an accessory to a user. |
| DELETE | `/api/asset/deleteAsset` | Delete an asset by ID. |
| GET | `/api/accessories` | Fetch accessories. |
| GET | `/api/asset` | Fetch assets or a single asset via `?id=`. |
| GET | `/api/consumable` | Fetch consumables. |
| GET | `/api/licence` | Fetch licences. |
| GET | `/api/location` | Fetch locations. |
| GET | `/api/manufacturer` | Fetch manufacturers. |
| GET | `/api/supplier` | Fetch suppliers. |
| GET | `/api/user` | Fetch users. |
| DELETE | `/api/user` | Delete a user. |
| PUT | `/api/user` | Update a user. |

## Database Schema

## Contributing

Contributions are welcome! Please follow these steps to contribute:

Fork the repository.

Create a new branch (git checkout -b feature-branch).

Make your changes.

Commit your changes (git commit -m 'Add some feature').

Push to the branch (git push origin feature-branch).

Create a new Pull Request.

## Licence

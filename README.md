# Community Water Supply Management System

A MongoDB backed dashboard for coordinating household water needs, community water points, service requests, and delivery or repair schedules.

## Features

- Dashboard overview with household and source totals, open requests, upcoming services, and a low-supply watch.
- Create, view, update, and delete records in all four MongoDB collections.
- Search by record details and filter by village or request/schedule status.
- MongoDB validation for required fields, unique IDs, allowed statuses, and water capacity.
- The original MongoDB Shell program from the project brief is included in `water_supply_management_mongodb.js`.

## Run the dashboard

Requirements: Node.js 18 or newer and a running MongoDB server, either local or hosted on MongoDB Atlas.

1. Open a terminal in this folder and install the packages:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env`. Set `MONGODB_URI` to your MongoDB connection string. The default uses a local database named `community_water_supply`.
3. Start the dashboard:

   ```sh
   npm start
   ```

4. Open `http://localhost:3000` in a browser.

The application connects to MongoDB before it starts accepting requests. It does not insert sample records automatically. Use the included Shell script if you want the sample data from the brief.

## Load the brief's sample data

With MongoDB Shell (`mongosh`) installed and MongoDB running, open a terminal in this folder and run:

```sh
mongosh < water_supply_management_mongodb.js
```

The extracted script drops the four named project collections before inserting the sample documents. Run it only when you intend to reset those collections. This is separate from starting the dashboard.

## API

Replace `:collection` with `households`, `waterSources`, `waterRequests`, or `deliverySchedules`.

| Method | Endpoint | Operation |
| --- | --- | --- |
| GET | `/api/:collection` | List records; supports `search`, `village`, and `status` filters |
| GET | `/api/:collection/:id` | Read one record |
| POST | `/api/:collection` | Create a record |
| PUT | `/api/:collection/:id` | Update a record |
| DELETE | `/api/:collection/:id` | Delete a record |
| GET | `/api/summary` | Dashboard totals and request status counts |
| GET | `/api/health` | MongoDB connection status |

The collections and fields follow the project brief: households, water sources, water requests, and delivery schedules. Request records refer to a household using `householdId`, matching the source project design.

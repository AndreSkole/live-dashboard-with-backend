# Live Sports Dashboard Wiki

This wiki gives a quick overview of how the project is structured and how the data flow works.

## Pages

- [Setup and Running](./Setup-and-Running.md)
- [Data Flow and Sync](./Data-Flow-and-Sync.md)
- [Deployment Notes](./Deployment-Notes.md)

## Project Summary

The project is a sports dashboard built with:

- Node.js and Express for the backend
- PostgreSQL for cached event data
- API-SPORTS for football and Formula 1 data
- Plain HTML, CSS and JavaScript on the frontend

## Key Ideas

- The frontend talks to the backend, not directly to API-SPORTS.
- The backend stores normalized event data in PostgreSQL.
- Football data is synced in a rolling date window.
- F1 race results are cached separately to reduce repeated API calls.


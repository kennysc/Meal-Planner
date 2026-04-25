# Frontend

React 19 + Vite client for the meal planner.

## Commands

- `npm run dev` - start Vite
- `npm run lint` - run ESLint
- `npm run typecheck` - run `tsc -b --noEmit`
- `npm run build` - typecheck and build production assets

## API URL

The app uses `VITE_API_URL` when set. Without it, requests use relative `/api` paths and rely on the Vite/Docker proxy.

For local frontend plus local backend, set:

```sh
VITE_API_URL=http://localhost:4000 npm run dev
```

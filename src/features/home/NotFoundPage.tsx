import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 className="text-title">Page not found</h1>
      <p className="text-body">
        Nothing lives at this address. <Link to="/">Back to the front page.</Link>
      </p>
    </section>
  );
}

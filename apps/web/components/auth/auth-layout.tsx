import type { ReactNode } from 'react';

export function AuthLayout({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-brand" aria-label="Fieldbook administration">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            F
          </span>
          <span>Fieldbook</span>
        </div>
        <div className="auth-brand-copy">
          <p className="eyebrow">FARM ADMINISTRATION</p>
          <h2>A clear place to manage the work.</h2>
          <p>
            Secure access for the people responsible for your farm workspace.
          </p>
        </div>
        <p className="auth-brand-note">
          Poultry Farm &amp; Feed Mill Management System
        </p>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
          {footer ? <div className="auth-footer">{footer}</div> : null}
        </div>
      </section>
    </main>
  );
}

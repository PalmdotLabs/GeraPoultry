'use client';

import { useCallback, useState } from 'react';
import { adminApi, type AdminAuditEventList } from './admin-api';
import { AdminTimestamp } from './format';
import { PageHeader } from './page-header';
import { Pagination } from './pagination';
import {
  AdminErrorState,
  AdminForbiddenState,
  AdminLoadingState,
} from './admin-states';
import { useAdminData } from './use-admin-data';

const PAGE_SIZE = 50;

export function AuditEventsScreen() {
  const [page, setPage] = useState(1);
  const load = useCallback(
    (signal: AbortSignal) =>
      adminApi.listAuditEvents({ page, perPage: PAGE_SIZE, signal }),
    [page],
  );
  const { data, loading, error, terminalStatus, reload } =
    useAdminData<AdminAuditEventList>(load, '/audit-events');

  return (
    <>
      <PageHeader
        title="Audit events"
        description="Inspect the newest server-recorded administration events and their JSON metadata. This view is read-only."
      />

      {terminalStatus === 'forbidden' ? (
        <AdminForbiddenState permission="audit.read" />
      ) : null}
      {terminalStatus === 'redirecting' ? (
        <AdminLoadingState
          title="Your session has expired"
          description="Taking you to sign in before returning to Audit events."
          redirecting
        />
      ) : null}
      {terminalStatus === null && loading ? (
        <AdminLoadingState title="Loading audit events" />
      ) : null}
      {terminalStatus === null && !loading && (error || !data) ? (
        <AdminErrorState
          title="Audit events unavailable"
          message={error ?? 'The audit event list could not be loaded.'}
          onRetry={reload}
        />
      ) : null}

      {terminalStatus === null && !loading && data ? (
        <section className="admin-panel" aria-labelledby="audit-list-heading">
          <div className="admin-panel-heading">
            <div>
              <h2 id="audit-list-heading">Recorded activity</h2>
              <p>
                Newest events first, with stable server ordering and explicit
                empty values.
              </p>
            </div>
          </div>

          {data.events.length === 0 ? (
            <div className="admin-empty" role="status">
              <h3>No audit events found</h3>
              <p>There are no recorded events on this page.</p>
              {page > 1 ? (
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setPage(1)}
                >
                  Return to first page
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="admin-table-wrap">
                <table className="admin-table admin-audit-table">
                  <caption className="sr-only">
                    Audit events, page {data.page}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Occurred</th>
                      <th scope="col">Actor</th>
                      <th scope="col">Action</th>
                      <th scope="col">Target</th>
                      <th scope="col">Request ID</th>
                      <th scope="col">JSON details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((event) => (
                      <tr key={event.id}>
                        <td>
                          <AdminTimestamp value={event.occurredAt} />
                        </td>
                        <td>
                          {event.actorId ? (
                            <code>{event.actorId}</code>
                          ) : (
                            <span className="admin-secondary-text">
                              No actor recorded
                            </span>
                          )}
                        </td>
                        <th scope="row">
                          <code>{event.action}</code>
                          <span className="admin-secondary-text">
                            Event {event.id}
                          </span>
                        </th>
                        <td>
                          <span>{event.targetType}</span>
                          {event.targetId ? (
                            <code className="admin-code-block">
                              {event.targetId}
                            </code>
                          ) : (
                            <span className="admin-secondary-text">
                              No target ID
                            </span>
                          )}
                        </td>
                        <td>
                          {event.requestId ? (
                            <code>{event.requestId}</code>
                          ) : (
                            <span className="admin-secondary-text">
                              Not recorded
                            </span>
                          )}
                        </td>
                        <td>
                          <details className="admin-json-details">
                            <summary>Inspect JSON</summary>
                            <pre>
                              <code>
                                {JSON.stringify(event.metadata, null, 2)}
                              </code>
                            </pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                label="Audit event pages"
                page={data.page}
                perPage={data.perPage}
                total={data.total}
                busy={loading}
                onPageChange={setPage}
              />
            </>
          )}
        </section>
      ) : null}
    </>
  );
}

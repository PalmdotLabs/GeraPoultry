'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { adminApi } from './admin-api';
import {
  AdminErrorState,
  AdminForbiddenState,
  AdminLoadingState,
} from './admin-states';
import { Pagination } from './pagination';
import { useAdminData } from './use-admin-data';

export function FlockListScreen({ canReadSetup }: { canReadSetup: boolean }) {
  const [page, setPage] = useState(1);
  const loadFlocks = useCallback(
    (signal: AbortSignal) => adminApi.listFlocks({ page, signal }),
    [page],
  );
  const loadSetup = useCallback(
    (signal: AbortSignal) =>
      canReadSetup
        ? Promise.all([
            adminApi.listFarmSetup('breeds', { signal }),
            adminApi.listFarmSetup('sheds', { signal }),
          ])
        : Promise.resolve(null),
    [canReadSetup],
  );
  const { data, loading, error, terminalStatus, reload } = useAdminData(
    loadFlocks,
    '/flocks',
  );
  const setup = useAdminData(loadSetup, '/flocks');

  if (terminalStatus === 'forbidden')
    return <AdminForbiddenState permission="flocks.read" />;
  if (terminalStatus === 'redirecting')
    return <AdminLoadingState title="Returning to sign in" redirecting />;
  if (loading) return <AdminLoadingState title="Loading flocks" />;
  if (error || !data)
    return (
      <AdminErrorState
        title="Could not load flocks"
        message={error ?? 'Try loading the list again.'}
        onRetry={reload}
      />
    );

  const [breeds, sheds] = setup.data ?? [[], []];
  const breedNames = new Map(breeds.map(({ id, name }) => [id, name]));
  const shedNames = new Map(sheds.map(({ id, name }) => [id, name]));

  return (
    <section className="admin-panel" aria-labelledby="flock-list-heading">
      <div className="admin-panel-heading">
        <h2 id="flock-list-heading">Arrivals</h2>
      </div>
      {setup.error && setup.terminalStatus === null && (
        <AdminErrorState
          title="Could not load breed and shed names"
          message="The list shows record IDs until names are available."
          onRetry={setup.reload}
        />
      )}
      {data.flocks.length === 0 ? (
        <div className="admin-empty">
          {data.total > 0 ? (
            <>
              <p>No arrivals on this page.</p>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setPage(1)}
              >
                Go to first page
              </button>
            </>
          ) : (
            <p>No flock arrivals recorded yet.</p>
          )}
        </div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table flock-arrival-table">
              <caption className="sr-only">
                Flock arrivals and initial placements
              </caption>
              <thead>
                <tr>
                  <th scope="col">Batch ID</th>
                  <th scope="col">Breed</th>
                  <th scope="col">Arrival date</th>
                  <th scope="col">Age at arrival</th>
                  <th scope="col">Birds housed</th>
                  <th scope="col">Initial placement</th>
                  <th scope="col">Current counts</th>
                </tr>
              </thead>
              <tbody>
                {data.flocks.map((flock) => (
                  <tr key={flock.id}>
                    <th scope="row">{flock.batchCode}</th>
                    <td>
                      {breedNames.get(flock.breedId) ?? (
                        <code>{flock.breedId}</code>
                      )}
                    </td>
                    <td>
                      <time dateTime={flock.arrivalDate}>
                        {flock.arrivalDate}
                      </time>
                    </td>
                    <td>
                      {flock.ageAtArrival}{' '}
                      {flock.ageAtArrival === 1
                        ? flock.ageUnit.slice(0, -1)
                        : flock.ageUnit}
                    </td>
                    <td>{flock.birdsHoused.toLocaleString('en-IN')}</td>
                    <td>
                      <ul className="admin-event-list">
                        {flock.placements.map(({ shedId, birdCount }) => (
                          <li key={shedId}>
                            {shedNames.get(shedId) ?? <code>{shedId}</code>}
                            {' · '}
                            {birdCount.toLocaleString('en-IN')}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <Link
                        className="text-link"
                        href={`/flocks/${flock.id}/mortality`}
                        aria-label={`Live counts for ${flock.batchCode}`}
                      >
                        Live counts
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            label="Flock pages"
            page={data.page}
            perPage={data.perPage}
            total={data.total}
            busy={loading}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
}

'use client';

import { useCallback, useState } from 'react';
import { adminApi } from './admin-api';
import {
  AdminErrorState,
  AdminForbiddenState,
  AdminLoadingState,
} from './admin-states';
import { Pagination } from './pagination';
import { useAdminData } from './use-admin-data';

export function EggCollectionListScreen({
  canReadSetup,
}: {
  canReadSetup: boolean;
}) {
  const [page, setPage] = useState(1);
  const load = useCallback(
    (signal: AbortSignal) => adminApi.listEggCollections({ page, signal }),
    [page],
  );
  const loadSetup = useCallback(
    (signal: AbortSignal) =>
      canReadSetup
        ? Promise.all([
            adminApi.listFarmSetup('sheds', { signal }),
            adminApi.listFarmSetup('egg-grades', { signal }),
          ])
        : Promise.resolve(null),
    [canReadSetup],
  );
  const list = useAdminData(load, '/egg-collections');
  const setup = useAdminData(loadSetup, '/egg-collections');

  if (list.terminalStatus === 'forbidden')
    return <AdminForbiddenState permission="eggs.collection.read" />;
  if (list.terminalStatus === 'redirecting')
    return <AdminLoadingState title="Returning to sign in" redirecting />;
  if (list.loading)
    return <AdminLoadingState title="Loading egg collections" />;
  if (list.error || !list.data) {
    return (
      <AdminErrorState
        title="Could not load egg collections"
        message={list.error ?? 'Try loading the list again.'}
        onRetry={list.reload}
      />
    );
  }

  const [sheds, grades] = setup.data ?? [[], []];
  const shedNames = new Map(sheds.map(({ id, name }) => [id, name]));
  const gradeNames = new Map(grades.map(({ id, name }) => [id, name]));
  const { collections, total, perPage } = list.data;

  return (
    <section className="admin-panel" aria-labelledby="collection-list-heading">
      <div className="admin-panel-heading">
        <h2 id="collection-list-heading">Recorded collections</h2>
      </div>
      {setup.error && setup.terminalStatus === null && (
        <AdminErrorState
          title="Could not load shed and grade names"
          message="Showing record IDs."
          onRetry={setup.reload}
        />
      )}
      {collections.length === 0 ? (
        <div className="admin-empty">
          <p>
            {total > 0
              ? 'No collections on this page.'
              : 'No egg collections recorded yet.'}
          </p>
          {total > 0 && (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setPage(1)}
            >
              Go to first page
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table flock-arrival-table">
              <caption className="sr-only">
                Recorded egg counts by shed and quality
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Shed</th>
                  <th scope="col">Shift</th>
                  <th scope="col">Grade</th>
                  <th scope="col">Good</th>
                  <th scope="col">Cracked</th>
                  <th scope="col">Dirty</th>
                  <th scope="col">Total eggs</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      <time dateTime={row.collectionDate}>
                        {row.collectionDate}
                      </time>
                    </th>
                    <td>
                      {shedNames.get(row.shedId) ?? <code>{row.shedId}</code>}
                    </td>
                    <td>{row.shift}</td>
                    <td>
                      {gradeNames.get(row.gradeId) ?? (
                        <code>{row.gradeId}</code>
                      )}
                    </td>
                    <td>{row.goodEggCount.toLocaleString('en-IN')}</td>
                    <td>{row.crackedEggCount.toLocaleString('en-IN')}</td>
                    <td>{row.dirtyEggCount.toLocaleString('en-IN')}</td>
                    <td>{row.totalEggCount.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            label="Egg collection pages"
            page={list.data.page}
            perPage={perPage}
            total={total}
            busy={false}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
}
